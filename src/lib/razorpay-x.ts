/**
 * RazorpayX API Integration Library
 * Handles Contacts, Fund Accounts, and Payouts for automated editor payments.
 */

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAYX_ACCOUNT_NUMBER = process.env.RAZORPAYX_ACCOUNT_NUMBER; // Your RazorpayX account number

const BASE_URL = 'https://api.razorpay.com/v1';

async function razorpayXFetch(endpoint: string, options: RequestInit = {}) {
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    
    const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.description || 'RazorpayX API error');
    }

    return data;
}

export const RazorpayX = {
    /**
     * Create or update a contact for an editor
     */
    async createContact(name: string, email: string, referenceId: string) {
        return razorpayXFetch('/contacts', {
            method: 'POST',
            body: JSON.stringify({
                name,
                email,
                type: 'vendor',
                reference_id: referenceId,
            }),
        });
    },

    /**
     * Create a bank fund account for a contact
     */
    async createBankFundAccount(contactId: string, accountHolderName: string, accountNumber: string, ifsc: string) {
        return razorpayXFetch('/fund_accounts', {
            method: 'POST',
            body: JSON.stringify({
                contact_id: contactId,
                account_type: 'bank_account',
                bank_account: {
                    name: accountHolderName,
                    ifsc,
                    account_number: accountNumber,
                },
            }),
        });
    },

    /**
     * Create a UPI fund account for a contact
     */
    async createUPIFundAccount(contactId: string, vpa: string) {
        return razorpayXFetch('/fund_accounts', {
            method: 'POST',
            body: JSON.stringify({
                contact_id: contactId,
                account_type: 'vpa',
                vpa: {
                    address: vpa,
                },
            }),
        });
    },

    /**
     * Create a payout
     */
    async createPayout(params: {
        fundAccountId: string;
        amount: number; // in paise
        currency: string;
        mode: 'IMPS' | 'NEFT' | 'RTGS' | 'UPI';
        purpose: 'payout' | 'refund' | 'salary';
        referenceId: string;
        narration: string;
    }) {
        if (!RAZORPAYX_ACCOUNT_NUMBER) {
            throw new Error('RAZORPAYX_ACCOUNT_NUMBER not configured');
        }

        return razorpayXFetch('/payouts', {
            method: 'POST',
            body: JSON.stringify({
                account_number: RAZORPAYX_ACCOUNT_NUMBER,
                fund_account_id: params.fundAccountId,
                amount: params.amount,
                currency: params.currency,
                mode: params.mode,
                purpose: params.purpose,
                reference_id: params.referenceId,
                narration: params.narration,
            }),
        });
    }
};
