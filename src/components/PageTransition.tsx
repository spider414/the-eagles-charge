import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

const PageTransition = ({ children }: PageTransitionProps) => {
  return (
    <div className="animate-page-enter">
      {children}
    </div>
  );
};

export default PageTransition;
