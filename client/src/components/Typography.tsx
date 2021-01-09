export const Typography: React.FC<TypographyProps> = ({
  type,
  size,
  color,
  children,
  weight,
  align,
}) => {
  const classes = `${size ?? "text-md"} ${color ?? "text-black"} ${
    weight ?? "font-normal"
  } mb-2 ${align ?? "align-start"}`;
  switch (type) {
    case "h1":
      return <h1 className={classes}>{children}</h1>;
    case "h2":
      return <h2 className={classes}>{children}</h2>;
    case "h3":
      return <h3 className={classes}>{children}</h3>;
    case "h4":
      return <h4 className={classes}>{children}</h4>;
    case "p":
      return <p className={classes}>{children}</p>;
    default:
      return <span className={classes}>{children}</span>;
  }
};

interface TypographyProps {
  type?: "h1" | "h2" | "h3" | "h4" | "span" | "p";
  color?: string;
  weight?: string;
  size?: string;
  align?: string;
}
