import { createPortal } from 'react-dom';

/**
 * Portal component that mounts children directly into document.body.
 * Ensures modals and overlays cleanly cover the entire viewport including
 * the top navbar and sidebar without z-index or stacking context clipping.
 */
export default function Portal({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
