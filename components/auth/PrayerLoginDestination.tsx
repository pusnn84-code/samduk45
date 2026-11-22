"use client";
import {useEffect} from "react";
import {rememberAutumnDestination} from "../../src/features/auth/prayer-return";
export function PrayerLoginDestination({path}:{path:string|null}){useEffect(()=>{if(path)rememberAutumnDestination(path);},[path]);return null;}
