import { Bird, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-gold shadow-gold">
            <Bird className="h-6 w-6 text-secondary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">
            THE <span className="text-gradient-gold">EAGLES</span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <a href="#airtime" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Airtime
          </a>
          <a href="#data" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Data
          </a>
          <a href="#about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            About
          </a>
          <Button size="sm">Get Started</Button>
        </nav>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-border bg-background animate-fade-in">
          <nav className="container flex flex-col gap-4 py-4">
            <a href="#airtime" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Airtime
            </a>
            <a href="#data" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Data
            </a>
            <a href="#about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              About
            </a>
            <Button size="sm" className="w-full">Get Started</Button>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
