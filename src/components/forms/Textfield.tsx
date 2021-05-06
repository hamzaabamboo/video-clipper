import { ChangeEventHandler } from "react";

export const Textfield: React.FC<TextFieldProps> = ({
  value,
  onChange,
  placeholder,
}) => {
  return (
    <input
      type="text"
      className="p-2 mr-2 rounded shadow-inner shadow-md border w-full"
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
