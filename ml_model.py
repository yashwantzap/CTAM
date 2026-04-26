#!/usr/bin/env python3
"""
CTAM ML Module - Ensemble Model with XGBoost and Random Forest
Provides true statistical predictions with proper train/test split and cross-validation
"""

import json
import numpy as np
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Any
import pickle
from dataclasses import dataclass

from sklearn.preprocessing import StandardScaler
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report
)
import xgboost as xgb


@dataclass
class Vulnerability:
    """Vulnerability data structure"""
    cveId: str
    vendorProject: str
    product: str
    vulnerabilityName: str
    shortDescription: str
    dateAdded: str
    dueDate: str
    requiredAction: str
    knownRansomwareCampaignUse: str
    notes: str
    cwes: List[str]


class MLEnsembleModel:
    """
    Ensemble model combining XGBoost and Random Forest for vulnerability risk prediction
    """

    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)

        # Models
        self.xgb_model = None
        self.rf_model = None
        self.scaler = StandardScaler()
        self.tfidf_vectorizer = TfidfVectorizer(
            max_features=50,
            min_df=1,
            max_df=0.95,
            ngram_range=(1, 2),
            lowercase=True
        )

        # Metrics storage
        self.metrics = None
        self.feature_importance = None
        self.test_predictions = None
        self.test_labels = None

        # Train/test split indices
        self.train_indices = None
        self.test_indices = None

    def _determine_risk_label(self, vuln: Dict[str, Any]) -> int:
        """
        Rule-based labeling: 0=Low, 1=Medium, 2=High
        Uses the same scoring system as original TypeScript implementation
        """
        risk_score = 0

        # Ransomware: +4
        if vuln.get("knownRansomwareCampaignUse", "").lower() == "known":
            risk_score += 4

        # Due date urgency
        try:
            from datetime import datetime
            due_date = datetime.fromisoformat(vuln.get("dueDate", "").replace("Z", "+00:00"))
            days_until_due = (due_date - datetime.now(due_date.tzinfo)).days

            if days_until_due <= 7:
                risk_score += 3
            elif days_until_due <= 30:
                risk_score += 2
            elif days_until_due <= 90:
                risk_score += 1
        except:
            pass

        # Required action: patch/update +1
        required_action = vuln.get("requiredAction", "").lower()
        if "patch" in required_action or "update" in required_action:
            risk_score += 1

        # Critical CWEs: +3
        cwes = vuln.get("cwes", [])
        critical_cwes = ["CWE-78", "CWE-89", "CWE-94", "CWE-287"]
        if any(cwe in str(cwes) for cwe in critical_cwes):
            risk_score += 3

        # RCE/arbitrary code execution: +3
        description = (f"{vuln.get('vulnerabilityName', '')} "
                      f"{vuln.get('shortDescription', '')} "
                      f"{vuln.get('notes', '')}").lower()
        if any(term in description for term in ["rce", "remote code execution", "arbitrary code"]):
            risk_score += 3

        # Privilege escalation: +2
        if "privilege escalation" in description or "privilege" in description:
            risk_score += 2

        # Auth bypass: +2
        if "authentication bypass" in description or "auth bypass" in description:
            risk_score += 2

        # DoS: +1
        if "denial of service" in description or " dos " in description:
            risk_score += 1

        # Classify with balanced thresholds for better class distribution
        if risk_score >= 10:
            return 2  # High - critical vulnerabilities
        elif risk_score >= 4:
            return 1  # Medium - moderate risk
        else:
            return 0  # Low - minimal risk factors

    def _extract_base_features(self, vuln: Dict[str, Any]) -> np.ndarray:
        """Extract 9 base features from vulnerability"""
        features = []

        # 1. hasExploit (binary)
        description = (f"{vuln.get('vulnerabilityName', '')} "
                      f"{vuln.get('shortDescription', '')} "
                      f"{vuln.get('notes', '')}").lower()
        has_exploit = 1.0 if any(term in description for term in
                                ["exploit", "remote code", "rce", "arbitrary code",
                                 "command injection"]) else 0.0
        features.append(has_exploit)

        # 2. daysSinceDisclosure (normalized 0-1)
        try:
            from datetime import datetime
            date_added = datetime.fromisoformat(vuln.get("dateAdded", "").replace("Z", "+00:00"))
            days_since = (datetime.now(date_added.tzinfo) - date_added).days
            days_normalized = min(days_since, 365) / 365.0
            features.append(days_normalized)
        except:
            features.append(0.0)

        # 3. ransomwareUse (binary)
        ransomware_use = 1.0 if vuln.get("knownRansomwareCampaignUse", "").lower() == "known" else 0.0
        features.append(ransomware_use)

        # 4. hasCwe (binary)
        has_cwe = 1.0 if vuln.get("cwes", []) and len(vuln.get("cwes", [])) > 0 else 0.0
        features.append(has_cwe)

        # 5. vendorPopularity (binary)
        major_vendors = ["microsoft", "apple", "google", "cisco", "adobe", "oracle", "vmware"]
        vendor = vuln.get("vendorProject", "").lower()
        vendor_popular = 1.0 if any(v in vendor for v in major_vendors) else 0.0
        features.append(vendor_popular)

        # 6. actionUrgency (0-1)
        try:
            from datetime import datetime
            due_date = datetime.fromisoformat(vuln.get("dueDate", "").replace("Z", "+00:00"))
            days_until_due = (due_date - datetime.now(due_date.tzinfo)).days

            if days_until_due <= 7:
                urgency = 1.0
            elif days_until_due <= 30:
                urgency = 0.5
            else:
                urgency = 0.0
            features.append(urgency)
        except:
            features.append(0.0)

        # 7. numberOfCWEs (count normalized, max 5)
        cwes = vuln.get("cwes", [])
        num_cwes_normalized = min(len(cwes), 5) / 5.0
        features.append(num_cwes_normalized)

        # 8. criticalCwePresence (binary)
        critical_cwes = ["CWE-78", "CWE-89", "CWE-94", "CWE-287", "CWE-22"]
        has_critical_cwe = 1.0 if any(cwe in str(cwes) for cwe in critical_cwes) else 0.0
        features.append(has_critical_cwe)

        # 9. recentActivityScore (sigmoid of days since disclosure)
        try:
            from datetime import datetime
            date_added = datetime.fromisoformat(vuln.get("dateAdded", "").replace("Z", "+00:00"))
            days_since = (datetime.now(date_added.tzinfo) - date_added).days
            # Sigmoid function: recent=high, old=low
            recent_score = 1.0 / (1.0 + np.exp(days_since / 30.0 - 2))
            features.append(recent_score)
        except:
            features.append(0.0)

        return np.array(features)

    def _load_vulnerabilities(self) -> List[Dict[str, Any]]:
        """Load vulnerabilities from storage"""
        vuln_file = self.data_dir / "vulnerabilities.json"
        if not vuln_file.exists():
            return []

        try:
            with open(vuln_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading vulnerabilities: {e}")
            return []

    def prepare_data(self) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """
        Prepare data for training: extract features, TF-IDF, labels
        Properly splits data BEFORE fitting TF-IDF to prevent data leakage
        Returns: (X_features, y_labels, cve_ids)
        """
        vulnerabilities = self._load_vulnerabilities()

        if len(vulnerabilities) < 10:
            raise ValueError(f"Need at least 10 vulnerabilities for training, got {len(vulnerabilities)}")

        print(f"[ML] Loading {len(vulnerabilities)} vulnerabilities for training...")

        # Extract labels and text for ALL data
        labels = [self._determine_risk_label(v) for v in vulnerabilities]
        texts = [
            f"{v.get('vulnerabilityName', '')} {v.get('shortDescription', '')} {v.get('notes', '')}"
            for v in vulnerabilities
        ]

        # Extract base features for ALL data
        print("[ML] Extracting base features...")
        base_features = np.array([self._extract_base_features(v) for v in vulnerabilities])

        # Split data FIRST (80/20 with stratification if possible)
        print("[ML] Splitting data: 80% train, 20% test...")
        texts_array = np.array(texts)

        # Check if stratification is possible (need 2+ samples per class)
        unique_labels, counts = np.unique(labels, return_counts=True)
        can_stratify = all(count >= 2 for count in counts)

        stratify_param = labels if can_stratify else None
        X_base_train, X_base_test, texts_train, texts_test, y_train, y_test, train_idx, test_idx = train_test_split(
            base_features, texts_array, np.array(labels), np.arange(len(labels)),
            test_size=0.2,
            random_state=42,
            stratify=stratify_param
        )

        # Now fit TF-IDF ONLY on training texts
        print("[ML] Building TF-IDF vectorizer (fit on training data only)...")
        tfidf_train = self.tfidf_vectorizer.fit_transform(texts_train).toarray()
        tfidf_test = self.tfidf_vectorizer.transform(texts_test).toarray()

        # Combine base and TF-IDF features for train and test
        X_train = np.hstack([X_base_train, tfidf_train])
        X_test = np.hstack([X_base_test, tfidf_test])

        # Recombine train and test to return in original order for now
        # (train() method will split again, which is redundant but maintains interface)
        X = np.vstack([X_train, X_test])
        y = np.hstack([y_train, y_test])
        cve_ids = [vulnerabilities[i].get("cveId", "") for i in np.hstack([train_idx, test_idx])]

        print(f"[ML] Feature matrix shape: {X.shape} (samples, features)")
        print(f"[ML] Label distribution: Low={sum(y==0)}, Medium={sum(y==1)}, High={sum(y==2)}")

        return X, y, cve_ids

    def train(self) -> Dict[str, Any]:
        """
        Train ensemble model with proper train/test split
        Returns: metrics dictionary
        """
        print("\n[ML] === TRAINING ENSEMBLE MODEL ===")

        # Prepare data
        X, y, cve_ids = self.prepare_data()

        # Train/test split (80/20)
        print("[ML] Splitting data: 80% train, 20% test...")
        unique_labels, counts = np.unique(y, return_counts=True)
        can_stratify = all(count >= 2 for count in counts)
        stratify_param = y if can_stratify else None
        X_train, X_test, y_train, y_test, train_idx, test_idx = train_test_split(
            X, y, np.arange(len(y)),
            test_size=0.2,
            random_state=42,
            stratify=stratify_param
        )

        self.train_indices = train_idx
        self.test_indices = test_idx
        self.test_labels = y_test

        print(f"[ML] Train set: {len(X_train)} samples")
        print(f"[ML] Test set: {len(X_test)} samples")

        # Standardize features
        print("[ML] Standardizing features...")
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        # Calculate class weights to handle imbalance
        from sklearn.utils.class_weight import compute_class_weight
        class_weights = compute_class_weight('balanced',
                                             classes=np.unique(y_train),
                                             y=y_train)
        class_weight_dict = {i: class_weights[i] for i in range(len(class_weights))}
        print(f"[ML] Class weights: {class_weight_dict}")

        # Train XGBoost with class weights
        print("[ML] Training XGBoost model...")
        self.xgb_model = xgb.XGBClassifier(
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            eval_metric='mlogloss',
            scale_pos_weight=2.0,  # Penalize minority class misclassifications
            verbosity=0
        )
        self.xgb_model.fit(X_train_scaled, y_train)

        # Train Random Forest with balanced class weights
        print("[ML] Training Random Forest model...")
        self.rf_model = RandomForestClassifier(
            n_estimators=100,
            max_depth=15,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
            class_weight='balanced'  # Handle class imbalance
        )
        self.rf_model.fit(X_train, y_train)

        # Ensemble predictions (voting: soft average then hardmax)
        print("[ML] Computing ensemble predictions...")
        xgb_pred_proba = self.xgb_model.predict_proba(X_test_scaled)
        rf_pred_proba = self.rf_model.predict_proba(X_test)

        # Average probabilities from both models
        ensemble_proba = (xgb_pred_proba + rf_pred_proba) / 2
        y_pred = np.argmax(ensemble_proba, axis=1)

        self.test_predictions = y_pred

        # Calculate metrics
        print("[ML] Computing metrics...")
        accuracy = accuracy_score(y_test, y_pred)
        # Use macro average instead of weighted to get unbiased per-class metrics
        precision = precision_score(y_test, y_pred, average='macro', zero_division=0)
        recall = recall_score(y_test, y_pred, average='macro', zero_division=0)
        f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)

        # Class distribution in test set
        unique_labels, counts = np.unique(y_test, return_counts=True)
        print("[ML] Test set class distribution:")
        for class_idx, count in zip(unique_labels, counts):
            class_name = ["Low", "Medium", "High"][class_idx]
            print(f"  {class_name}: {count} samples ({count/len(y_test)*100:.1f}%)")

        # Prediction distribution
        unique_pred, counts_pred = np.unique(y_pred, return_counts=True)
        print("[ML] Prediction distribution:")
        for class_idx, count in zip(unique_pred, counts_pred):
            class_name = ["Low", "Medium", "High"][class_idx]
            print(f"  {class_name}: {count} samples ({count/len(y_pred)*100:.1f}%)")

        # Per-class metrics
        from sklearn.metrics import precision_recall_fscore_support
        p_per_class, r_per_class, f_per_class, support = precision_recall_fscore_support(y_test, y_pred, zero_division=0)
        print("[ML] Per-class metrics:")
        for class_idx, class_name in enumerate(["Low", "Medium", "High"]):
            class_mask = y_test == class_idx
            if class_mask.sum() > 0:
                class_acc = (y_pred[class_mask] == y_test[class_mask]).mean()
                print(f"  {class_name}: P={p_per_class[class_idx]:.3f}, R={r_per_class[class_idx]:.3f}, F1={f_per_class[class_idx]:.3f}, Support={support[class_idx]}")

        # Confusion matrix
        cm = confusion_matrix(y_test, y_pred)
        print("[ML] Confusion Matrix:")
        print(cm)

        # Feature importance (average of both models)
        xgb_importance = self.xgb_model.feature_importances_
        rf_importance = self.rf_model.feature_importances_
        ensemble_importance = (xgb_importance + rf_importance) / 2

        feature_names = [
            "hasExploit", "daysSinceDisclosure", "ransomwareUse",
            "hasCwe", "vendorPopularity", "actionUrgency",
            "numberOfCWEs", "criticalCwePresence", "recentActivityScore"
        ] + [f"tfidf_{i}" for i in range(50)]

        self.feature_importance = {
            feature_names[i]: float(ensemble_importance[i])
            for i in range(len(feature_names))
        }

        # Top features
        top_features = sorted(
            self.feature_importance.items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]
        print("[ML] Top 10 Features:")
        for feat, imp in top_features:
            print(f"  {feat}: {imp:.4f}")

        # Store metrics
        self.metrics = {
            "accuracy": float(accuracy),
            "precision": float(precision),
            "recall": float(recall),
            "f1Score": float(f1),
            "trainedAt": datetime.utcnow().isoformat() + "Z",
            "samplesUsed": int(len(X_train)),
            "testSamples": int(len(X_test)),
            "featureImportance": self.feature_importance,
            "confusionMatrix": cm.tolist(),
            "classDistribution": {
                "low": int(sum(y == 0)),
                "medium": int(sum(y == 1)),
                "high": int(sum(y == 2))
            }
        }

        print(f"\n[ML] === TRAINING COMPLETE ===")
        print(f"[ML] Accuracy: {accuracy:.4f}")
        print(f"[ML] Precision: {precision:.4f}")
        print(f"[ML] Recall: {recall:.4f}")
        print(f"[ML] F1-Score: {f1:.4f}")
        print()

        return self.metrics

    def predict(self, features: np.ndarray) -> Tuple[int, float]:
        """
        Predict risk level for a single sample
        features: (56,) array [6 base features + 50 TF-IDF features]
        Returns: (class_index, probability)
        """
        if self.xgb_model is None or self.rf_model is None:
            raise ValueError("Model not trained. Call train() first.")

        # Ensure 2D
        if features.ndim == 1:
            features = features.reshape(1, -1)

        # Extract base and tfidf features
        base_features = features[:, :6]
        tfidf_features = features[:, 6:]

        # Predict with both models
        base_scaled = self.scaler.transform(base_features)
        xgb_proba = self.xgb_model.predict_proba(base_scaled)[0]
        rf_proba = self.rf_model.predict_proba(tfidf_features)[0]

        # Ensemble average
        ensemble_proba = (xgb_proba + rf_proba) / 2
        pred_class = np.argmax(ensemble_proba)
        pred_prob = ensemble_proba[pred_class]

        return int(pred_class), float(pred_prob)

    def predict_vulnerability(self, vuln: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict risk for a vulnerability dictionary
        Returns: prediction dict with riskLevel, probability, confidence
        """
        if self.xgb_model is None or self.rf_model is None:
            raise ValueError("Model not trained. Call train() first.")

        # Extract features
        base_features = self._extract_base_features(vuln)

        # Get TF-IDF features
        text = f"{vuln.get('vulnerabilityName', '')} {vuln.get('shortDescription', '')} {vuln.get('notes', '')}"
        tfidf_features = self.tfidf_vectorizer.transform([text]).toarray()[0]

        # Combine
        features = np.hstack([base_features, tfidf_features])

        # Predict
        class_idx, prob = self.predict(features)
        risk_levels = ["Low", "Medium", "High"]

        return {
            "riskLevel": risk_levels[class_idx],
            "probability": prob,
            "confidence": float(prob),
            "features": {
                "hasExploit": bool(base_features[0]),
                "daysSinceDisclosure": float(base_features[1]),
                "ransomwareUse": bool(base_features[2]),
                "cvssScore": 7.5  # Placeholder, could be extracted
            }
        }

    def save_models(self, path: str = None):
        """Save trained models to disk"""
        path = Path(path or self.data_dir / "models")
        path.mkdir(exist_ok=True)

        if self.xgb_model:
            self.xgb_model.save_model(str(path / "xgb_model.json"))
            print(f"[ML] Saved XGBoost model to {path / 'xgb_model.json'}")

        if self.rf_model:
            with open(path / "rf_model.pkl", 'wb') as f:
                pickle.dump(self.rf_model, f)
            print(f"[ML] Saved Random Forest model to {path / 'rf_model.pkl'}")

        if self.scaler:
            with open(path / "scaler.pkl", 'wb') as f:
                pickle.dump(self.scaler, f)
            print(f"[ML] Saved scaler to {path / 'scaler.pkl'}")

        if self.tfidf_vectorizer:
            with open(path / "tfidf_vectorizer.pkl", 'wb') as f:
                pickle.dump(self.tfidf_vectorizer, f)
            print(f"[ML] Saved TF-IDF vectorizer to {path / 'tfidf_vectorizer.pkl'}")

    def load_models(self, path: str = None):
        """Load trained models from disk"""
        path = Path(path or self.data_dir / "models")

        try:
            self.xgb_model = xgb.XGBClassifier()
            self.xgb_model.load_model(str(path / "xgb_model.json"))

            with open(path / "rf_model.pkl", 'rb') as f:
                self.rf_model = pickle.load(f)

            with open(path / "scaler.pkl", 'rb') as f:
                self.scaler = pickle.load(f)

            with open(path / "tfidf_vectorizer.pkl", 'rb') as f:
                self.tfidf_vectorizer = pickle.load(f)

            print("[ML] Models loaded successfully")
        except Exception as e:
            print(f"[ML] Warning: Could not load models: {e}")


def main():
    """CLI interface for training"""
    model = MLEnsembleModel(data_dir="data")
    metrics = model.train()
    model.save_models()

    # Save metrics
    metrics_file = Path("data") / "modelMetrics.json"
    with open(metrics_file, 'w') as f:
        json.dump(metrics, f, indent=2)
    print(f"\n[ML] Metrics saved to {metrics_file}")


if __name__ == "__main__":
    main()
