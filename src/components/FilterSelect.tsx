import { useTranslation } from "react-i18next";
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import type { SelectorOption } from "../selectorOptions";

type FilterSelectProps = {
  label: string;
  options: SelectorOption[];
  disabled?: boolean;
  title?: string;
  className?: string;
} & (
  | { multiple: true; value: string[]; onChange: (value: string[]) => void }
  | { multiple?: false; value: string; onChange: (value: string) => void }
);

export function FilterSelect(props: FilterSelectProps) {
  const { label, value, options, disabled, title, className } = props;
  const { t } = useTranslation();
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 190, maxHeight: 320 });
  const selectedValues = props.multiple ? props.value : [props.value];
  const selected =
    props.multiple && props.value.length
      ? options
          .filter((option) => selectedValues.includes(option.value))
          .map((option) => option.label)
          .join(", ")
      : (options.find((option) => option.value === (props.multiple ? "" : value))?.label ?? options[0]?.label);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => selectedValues.includes(option.value)),
  );
  useEffect(() => {
    setActive((index) => Math.max(0, Math.min(index, options.length - 1)));
    if (disabled) setOpen(false);
  }, [options.length, disabled]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = button.current!.getBoundingClientRect();
      const limit = Math.min(320, window.innerHeight * 0.45);
      const below = Math.max(0, window.innerHeight - rect.bottom - 12),
        above = Math.max(0, rect.top - 12);
      const upward = below < Math.min(limit, options.length * 38) && above > below;
      const height = Math.min(limit, upward ? above : below);
      const width = Math.max(0, Math.min(Math.max(rect.width, 240), window.innerWidth - 16));
      setPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top: upward
          ? Math.max(8, rect.top - Math.min(height, menu.current?.scrollHeight ?? height) - 4)
          : rect.bottom + 4,
        width,
        maxHeight: height,
      });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, options.length]);
  useEffect(() => {
    if (!open) return;
    menu.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !button.current?.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, id]);
  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    if (props.multiple) {
      props.onChange(
        !option.value
          ? []
          : props.value.includes(option.value)
            ? props.value.filter((item) => item !== option.value)
            : [...props.value, option.value],
      );
    } else {
      props.onChange(option.value);
      setOpen(false);
      button.current?.focus();
    }
  };
  return (
    <>
      <button
        ref={button}
        type="button"
        className={`analytics-filter-select ${className ?? ""}`}
        disabled={disabled}
        aria-label={label}
        title={title ?? selected}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          setActive(Math.max(0, selectedIndex));
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            setActive(Math.max(0, selectedIndex));
            setOpen(true);
          }
        }}
      >
        <span>{selected}</span>
        <ChevronDown size={16} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="listbox"
            tabIndex={-1}
            aria-label={label}
            aria-multiselectable={props.multiple || undefined}
            aria-activedescendant={`${id}-${active}`}
            className="analytics-filter-menu"
            style={position}
            onKeyDown={(event) => {
              if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Escape"].includes(event.key))
                event.preventDefault();
              if (event.key === "ArrowDown") setActive((index) => Math.min(options.length - 1, index + 1));
              if (event.key === "ArrowUp") setActive((index) => Math.max(0, index - 1));
              if (event.key === "Home") setActive(0);
              if (event.key === "End") setActive(options.length - 1);
              if (event.key === "Enter" || event.key === " ") choose(active);
              if (event.key === "Escape") {
                setOpen(false);
                button.current?.focus();
              }
              if (event.key === "Tab") setOpen(false);
            }}
          >
            {options.map((option, index) => (
              <Fragment key={option.value}>
                {option.archived && !options[index - 1]?.archived && (
                  <div
                    className={`filter-archive-heading ${options.slice(0, index).some((item) => item.value && !item.archived) ? "has-divider" : ""}`}
                    role="presentation"
                  >
                    {t("Archived")}
                  </div>
                )}
                {option.group !== undefined &&
                  (index === 0 ||
                    option.groupId !== options[index - 1]?.groupId ||
                    option.archived !== options[index - 1]?.archived) && (
                    <div className="filter-group-heading" role="presentation">
                      {option.group}
                    </div>
                  )}
                <div
                  key={option.value}
                  id={`${id}-${index}`}
                  role="option"
                  aria-selected={
                    props.multiple
                      ? !option.value
                        ? !props.value.length
                        : props.value.includes(option.value)
                      : option.value === value
                  }
                  className={active === index ? "active" : ""}
                  onMouseMove={() => setActive(index)}
                  onClick={() => choose(index)}
                >
                  {option.label}
                  {props.multiple && props.value.includes(option.value) && <span aria-hidden="true"> ✓</span>}
                </div>
              </Fragment>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
