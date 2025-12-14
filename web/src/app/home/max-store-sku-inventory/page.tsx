"use client";

import { useEffect } from "react";
import MaxStoreSkuInventoryPage from "../../../components/MaxStoreSkuInventoryPage";

export default function MaxStoreSkuInventoryRoute() {
    useEffect(() => {
        const uid = localStorage.getItem('userId');
        if (!uid) {
            window.location.href = '/login';
            return;
        }
    }, []);

    return <MaxStoreSkuInventoryPage />;
}

