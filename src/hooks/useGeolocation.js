// src/hooks/useGeolocation.js
// 📍 定位统一 hook：两条地图轨道共用（原 useMapTools 内一套 + MapTactical 内一套，现归一）
// 链路：GPS（高精度）→ 失败降级 IP（ipapi.co，低精度带警告标记）

import { useState, useCallback } from 'react';
import { getCurrentPosition } from '../utils/performanceHelpers';

export const useGeolocation = () => {
    const [userLocation, setUserLocation] = useState(null); // { lat, lon } | null
    const [isLocating, setIsLocating] = useState(false);
    const [locationError, setLocationError] = useState(null); // 定位失败原因（供 UI 提示）

    const locate = useCallback(async ({ fallbackToIP = true } = {}) => {
        setIsLocating(true);
        setLocationError(null);
        try {
            const position = await getCurrentPosition({ fallbackToIP });
            const next = {
                latitude: position.latitude,
                longitude: position.longitude,
                accuracy: position.accuracy, // 'low' = IP 兜底来的，低精度
                warning: position.warning || null
            };
            setUserLocation(next);
            return next;
        } catch (error) {
            setLocationError(error.message);
            return null;
        } finally {
            setIsLocating(false);
        }
    }, []);

    return { userLocation, isLocating, locationError, locate };
};
