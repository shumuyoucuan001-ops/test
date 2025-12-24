"use client";

import { useEffect } from "react";
import OpsActivityDispatchPage from "../../../components/OpsActivityDispatchPage";

export default function OpsActivityDispatchRoute() {
    useEffect(() => {
        const uid = localStorage.getItem('userId');
        if (!uid) {
            window.location.href = '/login';
            return;
        }
    }, []);

    return <OpsActivityDispatchPage />;
}

