"use client";

import { useEffect } from "react";
import OpsRegularActivityDispatchPage from "../../../components/OpsRegularActivityDispatchPage";

export default function OpsRegularActivityDispatchRoute() {
    useEffect(() => {
        const uid = localStorage.getItem('userId');
        if (!uid) {
            window.location.href = '/login';
            return;
        }
    }, []);

    return <OpsRegularActivityDispatchPage />;
}

