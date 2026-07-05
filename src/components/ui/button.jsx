export function Button({children,className="",...props}){return <button {...props} className={`px-4 py-2 rounded-md font-semibold transition ${className}`}>{children}</button>}
