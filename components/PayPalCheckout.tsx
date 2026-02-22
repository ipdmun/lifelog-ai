"use client";

import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

interface PayPalCheckoutProps {
    amount: string;
    onSuccess: (details: any) => void;
}

export default function PayPalCheckout({ amount, onSuccess }: PayPalCheckoutProps) {
    return (
        <PayPalScriptProvider options={{ clientId: "sb", currency: "USD" }}>
            <div className="z-0">
                <PayPalButtons
                    style={{ layout: "vertical", color: "gold", shape: "rect", label: "paypal" }}
                    createOrder={(data, actions) => {
                        return actions.order.create({
                            purchase_units: [
                                {
                                    amount: {
                                        value: amount,
                                        currency_code: "USD"
                                    },
                                },
                            ],
                            intent: "CAPTURE"
                        });
                    }}
                    onApprove={async (data, actions) => {
                        if (actions.order) {
                            const details = await actions.order.capture();
                            onSuccess(details);
                        }
                    }}
                />
            </div>
        </PayPalScriptProvider>
    );
}
