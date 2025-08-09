import type { SVGProps } from "react";

export const Icons = {
  logo: (props: SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M15.5 8.5c-.7-1-2-1.5-3.5-1.5-2.5 0-5 1.5-5 5" />
      <path d="M15.5 15.5c-.7 1-2 1.5-3.5 1.5-2.5 0-5-1.5-5-5" />
    </svg>
  ),
};
