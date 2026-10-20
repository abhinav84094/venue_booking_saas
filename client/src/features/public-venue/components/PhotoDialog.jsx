import { useRef, useEffect } from "react";
import { X } from "lucide-react";
export default function PhotoDialog({ photo, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      className="photo-dialog"
      ref={ref}
      onClose={onClose}
      aria-label={photo.alt || "Venue photograph"}
    >
      <button
        className="photo-close"
        onClick={() => ref.current.close()}
        aria-label="Close photograph"
      >
        <X size={24} />
      </button>
      <img src={photo.url} alt={photo.alt || "Venue photograph"} />
      {photo.alt && <p>{photo.alt}</p>}
    </dialog>
  );
}
