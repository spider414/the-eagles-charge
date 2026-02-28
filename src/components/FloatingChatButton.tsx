import { useState } from "react";
import { MessageCircle, X, Bot, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import SupportChatDialog from "@/components/SupportChatDialog";

const FloatingChatButton = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const whatsappNumber = "35677980822";
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hi, I need help with THE EAGLES VTU")}`;

  return (
    <>
      <SupportChatDialog open={chatOpen} onOpenChange={setChatOpen} />

      <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col items-end gap-2">
        {/* Expanded options */}
        {isExpanded && (
          <div className="flex flex-col gap-2 animate-fade-in">
            {/* AI Chat */}
            <Button
              onClick={() => {
                setChatOpen(true);
                setIsExpanded(false);
              }}
              className="rounded-full shadow-elevated h-12 px-4 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Bot className="h-5 w-5" />
              <span className="text-sm font-semibold">Chat with AI</span>
            </Button>

            {/* WhatsApp */}
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <Button
                className="rounded-full shadow-elevated h-12 px-4 gap-2 w-full"
                style={{ backgroundColor: "#25D366", color: "#fff" }}
              >
                <Phone className="h-5 w-5" />
                <span className="text-sm font-semibold">WhatsApp</span>
              </Button>
            </a>
          </div>
        )}

        {/* Main FAB */}
        <Button
          onClick={() => setIsExpanded(!isExpanded)}
          className="rounded-full h-14 w-14 shadow-elevated p-0 gradient-gold text-secondary-foreground hover:opacity-90"
          size="icon"
        >
          {isExpanded ? (
            <X className="h-6 w-6" />
          ) : (
            <MessageCircle className="h-6 w-6" />
          )}
        </Button>
      </div>
    </>
  );
};

export default FloatingChatButton;
