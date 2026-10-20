import { Monitor, Moon, Sun } from "lucide-react";
import { useThemePreference } from "../theme/useTheme";
import { setTheme } from "../theme/themeStore";

const options = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export default function ThemeToggle() {
  const preference = useThemePreference();
  const { Icon } = options.find((option) => option.value === preference);
  return (
    <div className="appearance-control" role="group" aria-label="Application appearance">
      <Icon size={17} aria-hidden="true" />
      <label className="sr-only" htmlFor="application-appearance">
        Appearance
      </label>
      <select
        id="application-appearance"
        value={preference}
        onChange={(event) => setTheme(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
