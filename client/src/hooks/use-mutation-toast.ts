import { useMutation, UseQueryClient } from "@tanstack/react-query";
import { useToast } from "./use-toast";
import type { UseMutationOptions } from "@tanstack/react-query";

interface MutationToastOptions<TData, TError, TVariables, TContext> extends UseMutationOptions<TData, TError, TVariables, TContext> {
  successTitle?: string;
  successDescription?: string | ((data: TData) => string);
  errorTitle?: string;
  errorDescription?: string | ((error: TError) => string);
  invalidateQueries?: string[];
}

/**
 * Custom hook that wraps useMutation with automatic toast notifications
 * Eliminates code duplication across pages
 */
export function useMutationWithToast<TData, TError, TVariables, TContext>(
  options: MutationToastOptions<TData, TError, TVariables, TContext>,
  queryClient?: UseQueryClient
) {
  const { toast } = useToast();

  const {
    successTitle = "Success",
    successDescription = "Operation completed successfully",
    errorTitle = "Error",
    errorDescription = "An error occurred",
    invalidateQueries = [],
    onSuccess: onSuccessCallback,
    onError: onErrorCallback,
    ...mutationOptions
  } = options;

  return useMutation({
    ...mutationOptions,
    onSuccess: (data, variables, context) => {
      const description = typeof successDescription === "function"
        ? successDescription(data)
        : successDescription;

      toast({
        title: successTitle,
        description,
      });

      // Invalidate queries if specified
      if (queryClient && invalidateQueries.length > 0) {
        invalidateQueries.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey: [queryKey] });
        });
      }

      onSuccessCallback?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const description = typeof errorDescription === "function"
        ? errorDescription(error)
        : errorDescription;

      toast({
        title: errorTitle,
        description: description || errorMsg,
        variant: "destructive",
      });

      onErrorCallback?.(error, variables, context);
    },
  });
}
