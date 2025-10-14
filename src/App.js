import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Mic, Trash2, Settings, LogOut, ZoomIn, ZoomOut, Camera, Upload, Wifi, WifiOff } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Firebase Config (CORRECT)
const firebaseConfig = {
  apiKey: "AIzaSyCJp4p1z004jsQfqWgyTZeIupXS0bCIT9U",
  authDomain: "park-it-pin-it-ad3f8.firebaseapp.com",
  projectId: "park-it-pin-it-ad3f8",
  storageBucket: "park-it-pin-it-ad3f8.firebasestorage.app",
  messagingSenderId: "394346806283",
  appId: "1:394346806283:web:ab2738e3b91fade1185b0e"
};

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = "AIzaSyAmocm8FS-rVPESd1W6WjFQ_s9x22dP1Po";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export default function ParkItPinIt() {
  const [user, setUser] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [parkingLocation, setParkingLocation] = useState(null);
  const [parkingPhoto, setParkingPhoto] = useState(null);
  const [savedLocations, setSavedLocations] = useState([]);
  const [screen, setScreen] = useState('map');
  const [isAnimating, setIsAnimating] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState(14);
  const [zoomLevel, setZoomLevel] = useState(13);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);
  const [cachedData, setCachedData] = useState([]);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Initialize Firebase Auth
  useEffect(() => {
    loadCachedData();
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncCachedData();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user]);

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => console.error('Location error:', error),
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }
  }, []);

  // Initialize Google Map
  useEffect(() => {
    if (mapRef.current && currentLocation && window.google) {
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
          zoom: zoomLevel,
          center: { lat: currentLocation.lat, lng: currentLocation.lng },
          styles: [
            {
              featureType: 'all',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#333' }],
            },
          ],
        });
      } else {
        mapInstanceRef.current.setCenter({ lat: currentLocation.lat, lng: currentLocation.lng });
        mapInstanceRef.current.setZoom(zoomLevel);
      }

      if (mapInstanceRef.current.markers) {
        mapInstanceRef.current.markers.forEach(marker => marker.setMap(null));
      }
      mapInstanceRef.current.markers = [];

      const currentMarker = new window.google.maps.Marker({
        position: { lat: currentLocation.lat, lng: currentLocation.lng },
        map: mapInstanceRef.current,
        title: 'Your Location',
        icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
      });
      mapInstanceRef.current.markers.push(currentMarker);

      if (parkingLocation) {
        const parkingMarker = new window.google.maps.Marker({
          position: { lat: parkingLocation.lat, lng: parkingLocation.lng },
          map: mapInstanceRef.current,
          title: 'Your Car',
          icon: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
        });
        mapInstanceRef.current.markers.push(parkingMarker);

        if (parkingPhoto) {
          const infoWindow = new window.google.maps.InfoWindow({
            content: `<div style="width: 200px;"><strong>Your Car</strong><br><img src="${parkingPhoto}" style="width: 100%; margin-top: 10px; border-radius: 4px;"></div>`,
          });
          parkingMarker.addListener('click', () => infoWindow.open(mapInstanceRef.current, parkingMarker));
        }
      }

      savedLocations.forEach((loc) => {
        const locMarker = new window.google.maps.Marker({
          position: { lat: loc.latitude, lng: loc.longitude },
          map: mapInstanceRef.current,
          title: loc.label,
          icon: 'http://maps.google.com/mapfiles/ms/icons/orange-dot.png',
        });
        mapInstanceRef.current.markers.push(locMarker);

        if (loc.photoUrl) {
          const infoWindow = new window.google.maps.InfoWindow({
            con
