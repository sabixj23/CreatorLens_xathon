export const number = (value: number) => new Intl.NumberFormat("en-SG", { maximumFractionDigits: 1 }).format(value);
export const compact = (value: number) => new Intl.NumberFormat("en-SG", { notation: "compact", maximumFractionDigits: 1 }).format(value);
