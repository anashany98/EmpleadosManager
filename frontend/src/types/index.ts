/**
 * Centralized TypeScript types for RRHH Frontend
 * Used to eliminate `any` types across the codebase
 */

// ============== API Types ==============

/** Generic API response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

/** Request options for API calls */
export interface RequestOptions {
  params?: Record<string, string | number | boolean | undefined | null>;
  responseType?: 'blob' | 'json';
}

/** API Error with status code */
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

// ============== User Types ==============

export interface User {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
}

// ============== Employee Types ==============

export interface Employee {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email: string;
  dni?: string;
  department?: string;
  phone?: string;
  active?: boolean;
  companyId?: string;
}

export interface EmployeeFilters {
  department?: string;
  status?: 'all' | 'active' | 'inactive';
  search?: string;
}

// ============== Dashboard Types ==============

export interface DashboardMetrics {
  totalEmployees: number;
  activeEmployees: number;
  pendingRequests: number;
}

export interface Company {
  id: string;
  name: string;
}

// ============== Notification Types ==============

export interface Notification {
  id: string;
  type: 'SUCCESS' | 'WARNING' | 'ERROR' | 'INFO';
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
}

// ============== Alert Types ==============

export interface Alert {
  id: string;
  type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  message: string;
  actionUrl?: string;
  createdAt: string;
  isRead: boolean;
}

// ============== Form Types ==============

export interface LoginFormData {
  email: string;
  password: string;
}

export interface FormField {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  validation?: {
    pattern?: RegExp;
    minLength?: number;
    maxLength?: number;
  };
}

// ============== UI State Types ==============

export interface LoadingState {
  isLoading: boolean;
  error?: string;
}

export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

// ============== Component Props Types ==============

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
}

export interface InputProps {
  name: string;
  label?: string;
  error?: string;
  placeholder?: string;
}

export interface SelectOption {
  value: string;
  label: string;
}