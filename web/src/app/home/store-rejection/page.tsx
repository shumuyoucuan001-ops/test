"use client";

import { useEffect } from "react";
import StoreRejectionPage from "../../../components/StoreRejectionPage";

export default function StoreRejectionRoute() {
    useEffect(() => {
        const uid = localStorage.getItem('userId');
        if (!uid) {
            window.location.href = '/login';
            return;
        }
    }, []);

    return <StoreRejectionPage />;
}

