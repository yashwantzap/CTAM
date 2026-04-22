import { useMemo, useState, useCallback } from "react";

interface FilterOptions<T> {
  items: T[] | undefined;
  searchFields?: (keyof T)[];
  filterField?: keyof T;
  filterOptions?: string[];
  itemsPerPage?: number;
}

interface FilterResult<T> {
  filteredItems: T[];
  paginatedItems: T[];
  totalPages: number;
  currentPage: number;
  search: string;
  activeFilter: string;
  setSearch: (search: string) => void;
  setFilter: (filter: string) => void;
  setPage: (page: number) => void;
  totalItems: number;
}

/**
 * Custom hook for filtering and paginating data
 * Eliminates duplicate filter/search/pagination logic across pages
 */
export function useFilteredData<T>({
  items,
  searchFields = [],
  filterField,
  filterOptions = ["all"],
  itemsPerPage = 10,
}: FilterOptions<T>): FilterResult<T> {
  const [search, setSearch] = useState("");
  const [activeFilter, setFilter] = useState("all");
  const [currentPage, setPage] = useState(1);

  // Memoized filtering
  const filteredItems = useMemo(() => {
    if (!items) return [];

    return items.filter((item) => {
      // Search filter
      const matchesSearch = !search || searchFields.some((field) => {
        const value = item[field];
        const searchStr = String(value).toLowerCase();
        return searchStr.includes(search.toLowerCase());
      });

      // Category filter
      const matchesFilter =
        activeFilter === "all" ||
        (filterField && String(item[filterField]) === activeFilter);

      return matchesSearch && matchesFilter;
    });
  }, [items, search, activeFilter, searchFields, filterField]);

  // Memoized pagination
  const { paginatedItems, totalPages } = useMemo(() => {
    const total = Math.ceil(filteredItems.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;

    return {
      paginatedItems: filteredItems.slice(start, end),
      totalPages: total,
    };
  }, [filteredItems, currentPage, itemsPerPage]);

  // Reset page when filter or search changes
  const handleSetSearch = useCallback((newSearch: string) => {
    setSearch(newSearch);
    setPage(1);
  }, []);

  const handleSetFilter = useCallback((newFilter: string) => {
    setFilter(newFilter);
    setPage(1);
  }, []);

  return {
    filteredItems,
    paginatedItems,
    totalPages,
    currentPage,
    search,
    activeFilter,
    setSearch: handleSetSearch,
    setFilter: handleSetFilter,
    setPage,
    totalItems: filteredItems.length,
  };
}

/**
 * Hook for managing URL-based search/filter/page params
 * Preserves state across page navigations
 */
export function useUrlFilteredData<T>({
  items,
  searchFields = [],
  filterField,
  itemsPerPage = 10,
}: Omit<FilterOptions<T>, "filterOptions">): FilterResult<T> {
  const [urlParams, setUrlParams] = useState(() => {
    if (typeof window === "undefined") return { search: "", filter: "all", page: "1" };

    const params = new URLSearchParams(window.location.search);
    return {
      search: params.get("search") || "",
      filter: params.get("filter") || "all",
      page: params.get("page") || "1",
    };
  });

  const updateUrl = useCallback((updates: Partial<typeof urlParams>) => {
    const newParams = { ...urlParams, ...updates };
    const searchParams = new URLSearchParams();

    if (newParams.search) searchParams.set("search", newParams.search);
    if (newParams.filter !== "all") searchParams.set("filter", newParams.filter);
    if (newParams.page !== "1") searchParams.set("page", newParams.page);

    const newUrl = `${window.location.pathname}${searchParams.toString() ? `?${searchParams}` : ""}`;
    window.history.replaceState(null, "", newUrl);
    setUrlParams(newParams);
  }, [urlParams]);

  const filteredData = useFilteredData({
    items,
    searchFields,
    filterField,
    itemsPerPage,
  });

  return {
    ...filteredData,
    search: urlParams.search,
    activeFilter: urlParams.filter,
    currentPage: parseInt(urlParams.page, 10),
    setSearch: (search) => updateUrl({ search, page: "1" }),
    setFilter: (filter) => updateUrl({ filter, page: "1" }),
    setPage: (page) => updateUrl({ page: String(page) }),
  };
}
