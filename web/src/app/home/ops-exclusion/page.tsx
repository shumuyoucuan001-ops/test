"use client";

import { useEffect } from "react";
import OpsExclusionPage from "../../../components/OpsExclusionPage";

export default function OpsExclusionRoute() {
    useEffect(() => {
        const uid = localStorage.getItem('userId');
        if (!uid) {
            window.location.href = '/login';
            return;
        }
    }, []);

    return <OpsExclusionPage />;
}
