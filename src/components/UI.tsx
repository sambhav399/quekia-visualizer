import React from 'react';

const handleClassList = (classList: string): string => {
  const list = classList.split(' ').map(c => c.trim());
  return Array.from(new Set(list)).join(' ');
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const Button: React.FC<ButtonProps> = ({ children, className, ...rest }) => {
  let classList = 'px-4 py-2 text-sm rounded-lg cursor-pointer disabled:opacity-50 font-medium';
  if (className) classList += ' ' + className;

  return (
    <button className={handleClassList(classList)} {...rest}>
      {children}
    </button>
  );
};

// type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

// export const Input: React.FC<InputProps> = ({ className, ...rest }) => {
//   let classList =
//     'px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500';
//   if (className) classList += ' ' + className;

//   return <input className={classList} {...rest} />;
// };

// type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

// export const Select: React.FC<SelectProps> = ({ className, children, ...rest }) => {
//   let classList =
//     'px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';
//   if (className) classList += ' ' + className;

//   return (
//     <select className={classList} {...rest}>
//       {children}
//     </select>
//   );
// };
