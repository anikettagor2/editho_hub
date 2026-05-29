import { Invoice } from "@/types/schema";
import { format } from "date-fns";

interface InvoiceSettings {
    companyName?: string;
    companyAddress?: string;
    companyEmail?: string;
    companyPhone?: string;
    companyLogo?: string;
    footerText?: string;
    bankDetails?: string;
    gstNumber?: string;
    termsAndConditions?: string;
}

interface InvoiceRendererProps {
    invoice: Invoice;
    settings?: InvoiceSettings;
}

// Helper to convert number to Indian Rupee Words
function toIndianRupeeWords(amount: number): string {
    const singleDigits = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const teenDigits = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const doubleDigits = ["", "Ten", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    
    const formatNumber = (num: number): string => {
        if (num === 0) return "";
        if (num < 10) return singleDigits[num];
        if (num < 20) return teenDigits[num - 10];
        if (num < 100) return doubleDigits[Math.floor(num / 10)] + (num % 10 !== 0 ? " " + singleDigits[num % 10] : "");
        return singleDigits[Math.floor(num / 100)] + " Hundred" + (num % 100 !== 0 ? " " + formatNumber(num % 100) : "");
    };

    const convert = (num: number): string => {
        if (num === 0) return "Zero";
        let words = "";
        
        const crores = Math.floor(num / 10000000);
        num %= 10000000;
        if (crores > 0) {
            words += formatNumber(crores) + " Crore ";
        }
        
        const lakhs = Math.floor(num / 100000);
        num %= 100000;
        if (lakhs > 0) {
            words += formatNumber(lakhs) + " Lakh ";
        }
        
        const thousands = Math.floor(num / 1000);
        num %= 1000;
        if (thousands > 0) {
            words += formatNumber(thousands) + " Thousand ";
        }
        
        if (num > 0) {
            words += formatNumber(num);
        }
        
        return words.trim();
    };
    
    const integerPart = Math.floor(amount);
    const paisePart = Math.round((amount - integerPart) * 100);
    
    let result = "Indian Rupee " + convert(integerPart);
    if (paisePart > 0) {
        result += " and " + convert(paisePart) + " Paise";
    }
    return result + " Only";
}

export function InvoiceRenderer({ invoice, settings }: InvoiceRendererProps) {
    const companyName = settings?.companyName || 'EditoHub';
    const companyAddress = settings?.companyAddress || 'Maharashtra\nIndia';
    const companyEmail = settings?.companyEmail || 'support@editohub.com';
    const companyPhone = settings?.companyPhone || '91-9096563651';
    const companyLogo = settings?.companyLogo || '/logo.png';
    const gstNumber = settings?.gstNumber || '27BNJPY0710N1ZI';
    const termsAndConditions = settings?.termsAndConditions || 'Due on Receipt';

    // GST Tax rates splits (standard Indian rules: CGST 9% and SGST 9% for 18% total tax)
    const totalTaxRate = invoice.tax ?? 18;
    const cgstPercent = totalTaxRate / 2;
    const sgstPercent = totalTaxRate / 2;

    const cgstTotalAmt = (invoice.subtotal * cgstPercent) / 100;
    const sgstTotalAmt = (invoice.subtotal * sgstPercent) / 100;

    // Payment state matching
    const isPaid = invoice.status === 'paid';
    const paymentMade = isPaid ? invoice.total : 0;
    const balanceDue = isPaid ? 0 : invoice.total;

    const totalInWords = toIndianRupeeWords(invoice.total);

    return (
        <div id="invoice-print-area" className="bg-white text-black p-8 max-w-[210mm] mx-auto min-h-[297mm] relative shadow-lg print:shadow-none print:p-0 print:m-0 print:w-full print:h-auto print:max-w-none font-sans">
            {/* Header Section */}
            <div className="flex justify-between items-end mb-6">
                <div className="flex items-start gap-4">
                    {companyLogo && (
                        <img 
                            src={companyLogo} 
                            alt="EditoHub Logo" 
                            className="h-16 w-auto object-contain" 
                            onError={(e) => {
                                // Fallback to hide logo broken image icon gracefully if missing
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                    )}
                    <div className="text-left text-[11px] leading-normal text-zinc-800">
                        <h2 className="text-sm font-bold text-black mb-0.5">{companyName}</h2>
                        <p className="whitespace-pre-line">{companyAddress}</p>
                        <p>GSTIN {gstNumber}</p>
                        <p>{companyPhone}</p>
                        <p>{companyEmail}</p>
                        <p>https://www.editohub.com/</p>
                    </div>
                </div>
                <div className="text-right">
                    <h1 className="text-3xl font-normal tracking-wide text-zinc-900 font-sans">TAX INVOICE</h1>
                </div>
            </div>

            {/* Invoice Meta Grid */}
            <div className="grid grid-cols-2 border border-zinc-400 text-xs mb-1">
                {/* Left Column */}
                <div className="p-3 border-r border-zinc-400 space-y-1">
                    <div className="flex">
                        <span className="w-24 text-zinc-500">#</span>
                        <span className="font-bold">: {invoice.invoiceNumber}</span>
                    </div>
                    <div className="flex">
                        <span className="w-24 text-zinc-500">Invoice Date</span>
                        <span className="font-bold">: {format(invoice.issueDate, "dd/MM/yyyy")}</span>
                    </div>
                    <div className="flex">
                        <span className="w-24 text-zinc-500">Due Date</span>
                        <span className="font-bold">: {format(invoice.dueDate, "dd/MM/yyyy")}</span>
                    </div>
                </div>
                {/* Right Column */}
                <div className="p-3 space-y-1">
                    <div className="flex">
                        <span className="w-32 text-zinc-500">Place Of Supply</span>
                        <span className="font-bold">: Maharashtra (27)</span>
                    </div>
                </div>
            </div>

            {/* Double Border Divider under Meta */}
            <div className="border-b-4 border-double border-zinc-400 pb-0.5 mb-5"></div>

            {/* Client Info Banner */}
            <div className="mb-5">
                <h3 className="font-bold text-sm text-zinc-900">{invoice.clientName}</h3>
            </div>

            {/* GST Items Table Grid */}
            <table className="w-full border-collapse border border-zinc-400 mb-6 text-xs">
                <thead>
                    <tr className="border-b border-zinc-400 bg-zinc-50 text-center font-semibold text-zinc-800">
                        <th rowSpan={2} className="py-2 border-r border-zinc-300 w-10">#</th>
                        <th rowSpan={2} className="py-2 border-r border-zinc-300 text-left px-3">Description</th>
                        <th rowSpan={2} className="py-2 border-r border-zinc-300 w-24">HSN/SAC</th>
                        <th rowSpan={2} className="py-2 border-r border-zinc-300 text-right px-2 w-14">Qty</th>
                        <th rowSpan={2} className="py-2 border-r border-zinc-300 text-right px-2 w-20">Rate</th>
                        <th colSpan={2} className="py-1 border-b border-r border-zinc-300">CGST</th>
                        <th colSpan={2} className="py-1 border-b border-r border-zinc-300">SGST</th>
                        <th rowSpan={2} className="py-2 text-right px-3 w-28">Amount</th>
                    </tr>
                    <tr className="border-b border-zinc-400 bg-zinc-50 text-[10px] font-semibold text-zinc-700 text-center">
                        <th className="py-1 border-r border-zinc-300 w-12">%</th>
                        <th className="py-1 border-r border-zinc-300 w-16">Amt</th>
                        <th className="py-1 border-r border-zinc-300 w-12">%</th>
                        <th className="py-1 border-r border-zinc-300 w-16">Amt</th>
                    </tr>
                </thead>
                <tbody>
                    {invoice.items.map((item, index) => {
                        const itemCgstAmt = (item.amount * cgstPercent) / 100;
                        const itemSgstAmt = (item.amount * sgstPercent) / 100;

                        return (
                            <tr key={index} className="border-b border-zinc-300 text-center last:border-b-zinc-400 text-zinc-800">
                                <td className="py-3 border-r border-zinc-300">{index + 1}</td>
                                <td className="py-3 border-r border-zinc-300 text-left px-3 font-medium text-zinc-950">
                                    {item.description || 'Video Editing'}
                                </td>
                                <td className="py-3 border-r border-zinc-300 text-zinc-600">998314</td>
                                <td className="py-3 border-r border-zinc-300 text-right px-2">{item.quantity.toFixed(2)}</td>
                                <td className="py-3 border-r border-zinc-300 text-right px-2">{item.rate.toFixed(2)}</td>
                                <td className="py-3 border-r border-zinc-300 text-zinc-600">{cgstPercent}%</td>
                                <td className="py-3 border-r border-zinc-300 text-right px-2 text-zinc-600">{itemCgstAmt.toFixed(2)}</td>
                                <td className="py-3 border-r border-zinc-300 text-zinc-600">{sgstPercent}%</td>
                                <td className="py-3 border-r border-zinc-300 text-right px-2 text-zinc-600">{itemSgstAmt.toFixed(2)}</td>
                                <td className="py-3 text-right px-3 font-medium text-zinc-950">{item.amount.toFixed(2)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* Bottom Content Split (Words & Totals) */}
            <div className="flex justify-between items-start text-xs">
                {/* Left Side: Conversion & Message */}
                <div className="w-[50%] pr-4 flex flex-col justify-between self-stretch">
                    <div>
                        <p className="text-[10px] uppercase font-bold text-zinc-500 mb-1">Total In Words</p>
                        <p className="font-bold italic text-zinc-950 text-sm leading-snug">{totalInWords}</p>
                    </div>
                    <div className="mt-auto pt-6">
                        <p className="text-zinc-800 text-sm">Thanks for your business.</p>
                    </div>
                </div>

                {/* Right Side: Totals Border Box */}
                <div className="w-[45%] border border-zinc-400 text-xs">
                    <div className="flex justify-between p-2 border-b border-zinc-300">
                        <span className="text-zinc-600">Sub Total</span>
                        <span className="font-mono text-zinc-900">{invoice.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between p-2 border-b border-zinc-300">
                        <span className="text-zinc-600">CGST{cgstPercent} ({cgstPercent}%)</span>
                        <span className="font-mono text-zinc-900">{cgstTotalAmt.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between p-2 border-b border-zinc-300">
                        <span className="text-zinc-600">SGST{sgstPercent} ({sgstPercent}%)</span>
                        <span className="font-mono text-zinc-900">{sgstTotalAmt.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between p-2 border-b border-zinc-300 font-bold text-zinc-950 bg-zinc-50/30">
                        <span>Total</span>
                        <span className="font-mono text-zinc-950 font-bold">₹{invoice.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between p-2 border-b border-zinc-300 text-red-600 font-semibold bg-red-50/20">
                        <span>Payment Made</span>
                        <span className="font-mono text-red-600 font-semibold">(-) {paymentMade.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between p-2 font-bold text-sm text-black bg-zinc-50">
                        <span>Balance Due</span>
                        <span className="font-mono font-bold text-zinc-950">₹{balanceDue.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Terms at the bottom of the page */}
            {termsAndConditions && (
                <div className="mt-12 text-[10px] text-zinc-500 border-t border-zinc-200 pt-3">
                    <span className="font-bold text-zinc-700">Terms & Conditions: </span>
                    <span>{termsAndConditions}</span>
                </div>
            )}
        </div>
    );
}
