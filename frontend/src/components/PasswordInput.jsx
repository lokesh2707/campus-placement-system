import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Password field with show/hide toggle (eye icon).
 */
const PasswordInput = ({
  id,
  value,
  onChange,
  placeholder = "",
  required = false,
  minLength,
  className = "w-full px-3.5 py-2 rounded-xl border border-sage focus:outline-none focus:ring-2 focus:ring-teal text-sm bg-white pr-11",
  autoComplete = "current-password",
  ...rest
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className={className}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink rounded-md transition"
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={0}
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};

export default PasswordInput;
