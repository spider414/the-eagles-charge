import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <BrandLogo className="h-10 w-10" rounded="rounded-xl" />
          <span className="text-xl font-bold text-foreground">
            HARMIC <span className="text-gradient-gold">RECHARGE</span>
          </span>
        </Link>

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
          <Link to="/auth">
            <Button size="sm">Get Started</Button>
          </Link>
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
            <Link to="/auth">
              <Button size="sm" className="w-full">Get Started</Button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
