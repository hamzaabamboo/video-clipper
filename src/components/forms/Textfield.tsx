import { ChangeEventHandler } from "react";
import { FCWithChildren } from "src/types/FCWithChildren";

export const Textfield: FCWithChildren<TextFieldProps> = ({
  value,
  onChange,
  placeholder,
}) => {
  return (
    <input
      type="text"
      className="shadow-inner shadow-md mr-2 p-2 border rounded w-full"
      value={value}
      placeholder={placeholder ?? ""}
      onChange={onChange}
    />
  );
};

interface TextFieldProps {
  value?: string | number;
  onChange: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
}
