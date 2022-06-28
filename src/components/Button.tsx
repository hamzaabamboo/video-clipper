import { FCWithChildren } from "src/types/FCWithChildren";

export const Button: FCWithChildren<ButtonProps> = ({
  color,
  fontColor,
  onClick,
  disabled,
  children,
}) => {
  return (
    <button
      className={`rounded p-2 m-1 shadow-md ${color ?? "bg-blue-400"} ${
        fontColor ?? "font-black-400"
      }`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

interface ButtonProps {
  color?: string;
  onClick: (e: React.MouseEvent) => void;
  fontColor?: string;
  disabled?: boolean;
}
