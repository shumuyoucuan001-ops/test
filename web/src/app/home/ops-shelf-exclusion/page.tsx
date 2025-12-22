"use client";

import { useEffect } from "react";
import OpsShelfExclusionPage from "../../../components/OpsShelfExclusionPage";

export default function OpsShelfExclusionRoute() {
    useEffect(() => {
        const uid = localStorage.getItem('userId');
        if (!uid) {
            window.location.href = '/login';
            return;
        }
    }, []);

    return <OpsShelfExclusionPage />;
}

