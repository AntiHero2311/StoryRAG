// Custom hooks barrel export
export { useAuth } from './useAuth';
export type { UserInfo } from './useAuth';

export { useDebounce } from './useDebounce';

export { useLocalStorage } from './useLocalStorage';

export { 
  useMediaQuery, 
  useIsMobile, 
  useIsTablet, 
  useIsDesktop 
} from './useMediaQuery';

export { default as useEditorSettings } from './useEditorSettings';

export { useDeleteConfirm } from './useDeleteConfirm';
export type { DeleteConfirmOptions } from './useDeleteConfirm';
