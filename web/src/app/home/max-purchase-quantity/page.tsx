"use client";

import { useEffect } from "react";
import MaxPurchaseQuantityPage from "../../../components/MaxPurchaseQuantityPage";

export default function MaxPurchaseQuantityRoute() {
    useEffect(() => {
        const uid = localStorage.getItem('userId');
        if (!uid) {
            window.location.href = '/login';
            return;
        }
    }, []);

    return <MaxPurchaseQuantityPage />;
}

