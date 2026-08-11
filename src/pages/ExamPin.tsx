import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { chargeTotal } from "@/lib/pricing";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Loader2, ShoppingCart, CheckCircle2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useWalletPayment } from "@/hooks/useWalletPayment";
import { supabase } from "@/integrations/supabase/client";
import PageTransition from "@/components/PageTransition";

interface ExamProduct {
  id: number;
  name: string;
  price: number;
}

interface PurchaseResult {
  exam_name: string;
  quantity: number;
  pins: string[];
}

const ExamPin = () => {
  const navigate = useNavigate();
  const { formatCurrency } = useLanguage();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { payWithWallet, isLoading: walletLoading, walletBalance } = useWalletPayment();

  const [products, setProducts] = useState<ExamProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<ExamProduct | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResult | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase.functions.invoke("vtu-service", {
        body: { action: "exam_pin_products" },
      });

      if (error) throw error;

      if (data?.success && Array.isArray(data.data)) {
        setProducts(data.data);
      } else if (data?.success && data.data?.products) {
        setProducts(data.data.products);
      } else {
        // Fallback products if API doesn't return them
        setProducts([
          { id: 1, name: "WAEC", price: 3400 },
          { id: 2, name: "NECO", price: 1500 },
          { id: 3, name: "NABTEB", price: 1500 },
        ]);
      }
    } catch (error) {
      console.error("Failed to fetch exam products:", error);
      // Use fallback
      setProducts([
        { id: 1, name: "WAEC", price: 3400 },
        { id: 2, name: "NECO", price: 1500 },
        { id: 3, name: "NABTEB", price: 1500 },
      ]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const totalAmount = selectedProduct ? selectedProduct.price * quantity : 0;
  const payableAmount = chargeTotal("exam_pin", totalAmount);

  const handlePurchase = async () => {
    if (!selectedProduct) return;

    const success = await payWithWallet({
      amount: totalAmount,
      metadata: {
        transaction_type: "exam_pin",
        exam_product_id: selectedProduct.id,
        exam_quantity: quantity,
        exam_name: selectedProduct.name,
      },
    });

    if (success) {
      // Try to extract pins from the transaction response
      toast({
        title: "Purchase Successful!",
        description: `Your ${selectedProduct.name} PIN(s) have been purchased. Check your transaction history for details.`,
      });
      // Reset form
      setSelectedProduct(null);
      setQuantity(1);
    }
  };

  const handleCopyPin = (pin: string, index: number) => {
    navigator.clipboard.writeText(pin);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast({ title: "Copied!", description: "PIN copied to clipboard" });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-soft text-primary">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 shadow-lg">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold">Exam PINs</h1>
                  <p className="text-xs text-muted-foreground">WAEC, NECO, NABTEB</p>
                </div>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              Bal: {formatCurrency(walletBalance)}
            </Badge>
          </div>
        </header>

        <main className="container py-6 max-w-lg mx-auto space-y-6">
          {/* Purchase Result */}
          {purchaseResult && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  PINs Purchased Successfully
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {purchaseResult.exam_name} × {purchaseResult.quantity}
                </p>
                {purchaseResult.pins.map((pin, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-background rounded-lg p-3 border">
                    <code className="text-sm font-mono break-all">{pin}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 ml-2"
                      onClick={() => handleCopyPin(pin, idx)}
                    >
                      {copiedIndex === idx ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Product Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Buy Exam PIN</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingProducts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Exam Type */}
                  <div className="space-y-2">
                    <Label>Exam Type</Label>
                    <Select
                      value={selectedProduct?.id.toString() || ""}
                      onValueChange={(val) => {
                        const product = products.find((p) => p.id.toString() === val);
                        setSelectedProduct(product || null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select exam type" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id.toString()}>
                            {product.name} — {formatCurrency(product.price)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quantity */}
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Select
                      value={quantity.toString()}
                      onValueChange={(val) => setQuantity(parseInt(val))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 PIN</SelectItem>
                        <SelectItem value="2">2 PINs</SelectItem>
                        <SelectItem value="5">5 PINs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Summary */}
                  {selectedProduct && (
                    <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Exam</span>
                        <span className="font-medium">{selectedProduct.name}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Price per PIN</span>
                        <span>{formatCurrency(selectedProduct.price)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Quantity</span>
                        <span>{quantity}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Service fee (2%)</span>
                        <span>{formatCurrency((payableAmount - totalAmount))}</span>
                      </div>
                      <div className="border-t border-border pt-2 flex justify-between font-semibold">
                        <span>Total</span>
                        <span className="text-primary">{formatCurrency(payableAmount)}</span>
                      </div>
                    </div>
                  )}

                  {/* Purchase Button */}
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={!selectedProduct || walletLoading || walletBalance < payableAmount}
                    onClick={handlePurchase}
                  >
                    {walletLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Pay {formatCurrency(payableAmount)} from Wallet
                      </>
                    )}
                  </Button>

                  {selectedProduct && walletBalance < payableAmount && (
                    <p className="text-xs text-destructive text-center">
                      Insufficient wallet balance. Please top up first.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </PageTransition>
  );
};

export default ExamPin;
