import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Mic, Trash2, Settings, LogOut, ZoomIn, ZoomOut, Camera, Upload, Wifi, WifiOff } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Firebase Config (REPLACE WITH YOUR CONFIG)
const firebaseConfig = {
  apiKey: "AIzaSyAmocm8FS-rVPESd1W6WjFQ_s9x22dP1Po",
  authDomain: "park-it-pin-it-ad3f8.firebaseapp.com",
  projectId: "park-it-pin-it-ad3f8",
  storageBucket: "park-it-pin-it-ad3f8.firebasestorage.app",
  messagingSenderId: "394346806283",
  appId: "1:394346806283:web:0e03b53cdea73a11185b0e"
};

// Google Maps API Key (REPLACE WITH YOUR KEY)
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
    signInAnonymously(auth).then((result) => {
      setUser(result.user);
      loadCachedData();
      loadCloudData(result.user.uid);
    });
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

      // Clear existing markers
      if (mapInstanceRef.current.markers) {
        mapInstanceRef.current.markers.forEach(marker => marker.setMap(null));
      }
      mapInstanceRef.current.markers = [];

      // Add current location marker (blue)
      const currentMarker = new window.google.maps.Marker({
        position: { lat: currentLocation.lat, lng: currentLocation.lng },
        map: mapInstanceRef.current,
        title: 'Your Location',
        icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
      });
      mapInstanceRef.current.markers.push(currentMarker);

      // Add parking marker (red)
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

      // Add saved locations markers (orange)
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
            content: `<div style="width: 200px;"><strong>${loc.label}</strong><br><img src="${loc.photoUrl}" style="width: 100%; margin-top: 10px; border-radius: 4px;"></div>`,
          });
          locMarker.addListener('click', () => infoWindow.open(mapInstanceRef.current, locMarker));
        }
      });
    }
  }, [currentLocation, parkingLocation, savedLocations, zoomLevel, parkingPhoto]);

  // Load script for Google Maps
  useEffect(() => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  // Load cached data from local storage
  const loadCachedData = () => {
    const cached = localStorage.getItem('parkItPinItCache');
    if (cached) {
      setCachedData(JSON.parse(cached));
      const data = JSON.parse(cached);
      if (data.parkingLocation) {
        setParkingLocation(data.parkingLocation);
        setParkingPhoto(data.parkingPhoto || null);
      }
      if (data.savedLocations) {
        setSavedLocations(data.savedLocations);
      }
    }
  };

  // Load cloud data from Firebase
  const loadCloudData = async (uid) => {
    if (!isOnline) return;

    try {
      const locationsRef = collection(db, 'users', uid, 'locations');
      const snapshot = await getDocs(locationsRef);
      const locations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      setSavedLocations(locations);
      const parkingPin = locations.find(loc => loc.category === 'parking' && loc.isActive);
      if (parkingPin) {
        setParkingLocation({
          lat: parkingPin.latitude,
          lng: parkingPin.longitude,
        });
        setParkingPhoto(parkingPin.photoUrl || null);
      }
    } catch (error) {
      console.error('Error loading cloud data:', error);
    }
  };

  // Save to cache
  const saveToCache = (parkingLoc, savedLocs, photo) => {
    const cacheData = {
      parkingLocation: parkingLoc,
      parkingPhoto: photo,
      savedLocations: savedLocs,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem('parkItPinItCache', JSON.stringify(cacheData));
  };

  // Sync cached data to cloud
  const syncCachedData = async () => {
    if (!user || !isOnline) return;

    setIsSyncing(true);
    try {
      // Upload parking location if it exists
      if (parkingLocation) {
        const parkingRef = collection(db, 'users', user.uid, 'locations');
        const existingParking = (await getDocs(query(parkingRef, where('category', '==', 'parking')))).docs;

        if (existingParking.length > 0) {
          await updateDoc(doc(db, 'users', user.uid, 'locations', existingParking[0].id), {
            latitude: parkingLocation.lat,
            longitude: parkingLocation.lng,
            photoUrl: parkingPhoto,
            syncedAt: new Date(),
          });
        } else {
          await addDoc(parkingRef, {
            latitude: parkingLocation.lat,
            longitude: parkingLocation.lng,
            label: 'My Car',
            category: 'parking',
            isActive: true,
            photoUrl: parkingPhoto,
            timestamp: new Date(),
            syncedAt: new Date(),
          });
        }
      }

      // Sync saved locations
      for (const loc of savedLocations) {
        if (!loc.id || loc.id.includes('local')) {
          const locRef = collection(db, 'users', user.uid, 'locations');
          await addDoc(locRef, {
            latitude: loc.latitude,
            longitude: loc.longitude,
            label: loc.label,
            category: 'custom',
            photoUrl: loc.photoUrl,
            timestamp: new Date(),
            syncedAt: new Date(),
          });
        }
      }

      setIsSyncing(false);
    } catch (error) {
      console.error('Sync error:', error);
      setIsSyncing(false);
    }
  };

  const handlePinCar = async () => {
    if (!currentLocation) return;

    setIsAnimating(true);
    setParkingLocation(currentLocation);
    setShowPhotoPrompt(true);

    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance('Done!');
    synth.speak(utterance);

    saveToCache(currentLocation, savedLocations, null);

    setTimeout(() => {
      setIsAnimating(false);
    }, 2000);
  };

  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Read file as data URL for immediate display
      const reader = new FileReader();
      reader.onload = (event) => {
        const photoDataUrl = event.target.result;
        setParkingPhoto(photoDataUrl);
        saveToCache(parkingLocation, savedLocations, photoDataUrl);

        // Upload to Firebase if online
        if (isOnline && user) {
          const photoRef = ref(storage, `users/${user.uid}/parking_photos/${Date.now()}`);
          uploadBytes(photoRef, file).then((snapshot) => {
            getDownloadURL(snapshot.ref).then((url) => {
              setParkingPhoto(url);
              saveToCache(parkingLocation, savedLocations, url);
            });
          });
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Photo upload error:', error);
    }

    setShowPhotoPrompt(false);
  };

  const handleAddLocation = () => {
    if (!currentLocation) return;
    const name = prompt('Name this location:');
    if (name) {
      const newLocation = {
        id: `local_${Date.now()}`,
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        label: name,
        category: 'custom',
        timestamp: new Date(),
      };
      const updated = [...savedLocations, newLocation];
      setSavedLocations(updated);
      saveToCache(parkingLocation, updated, parkingPhoto);

      // Upload to cloud if online
      if (isOnline && user) {
        addDoc(collection(db, 'users', user.uid, 'locations'), newLocation);
      }
    }
  };

  const handleDeleteLocation = async (id) => {
    const updated = savedLocations.filter(loc => loc.id !== id);
    setSavedLocations(updated);
    saveToCache(parkingLocation, updated, parkingPhoto);

    if (isOnline && user && !id.includes('local')) {
      await deleteDoc(doc(db, 'users', user.uid, 'locations', id));
    }
  };

  const handleClearParking = () => {
    setParkingLocation(null);
    setParkingPhoto(null);
    saveToCache(null, savedLocations, null);
  };

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  };

  // LOGIN SCREEN
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="flex items-center justify-center mb-8">
            <MapPin className="w-12 h-12 text-red-500 mr-3" />
            <h1 className="text-3xl font-bold text-gray-800">Park-It-Pin-It</h1>
          </div>

          <p className="text-gray-600 text-center mb-8 text-sm">
            Never lose your car in a parking lot again. Smart location pinning with maps.
          </p>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-800 text-sm mb-2">✨ Features:</h3>
            <ul className="text-xs text-gray-700 space-y-1">
              <li>✓ Real Google Maps</li>
              <li>✓ Photo landmarks</li>
              <li>✓ Works offline</li>
              <li>✓ Auto sync</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // MAP SCREEN
  if (screen === 'map') {
    return (
      <div className="h-screen w-full bg-white flex flex-col">
        <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center">
              <MapPin className="w-6 h-6 text-red-500 mr-2" />
              Park-It-Pin-It
            </h1>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="w-5 h-5 text-green-500" title="Online" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-500" title="Offline" />
              )}
              <button
                onClick={() => setScreen('settings')}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <Settings className="w-6 h-6 text-gray-600" />
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {isSyncing ? 'Syncing...' : isOnline ? 'Online' : 'Offline - Using cached data'}
          </p>
        </div>

        {/* Google Map */}
        <div className="flex-1 relative overflow-hidden">
          <div ref={mapRef} className="w-full h-full" />

          {isAnimating && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 backdrop-blur-sm">
              <div className="bg-white rounded-2xl p-8 shadow-2xl text-center">
                <div className="mb-4 text-6xl">✋</div>
                <div className="text-4xl mb-4 animate-pulse">📍</div>
                <p className="text-xl font-bold text-gray-800">Parking pinned!</p>
                <p className="text-gray-600 text-sm mt-2">Ready for photo?</p>
              </div>
            </div>
          )}

          {/* Zoom Controls */}
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md p-2 flex flex-col gap-2">
            <button
              onClick={() => setZoomLevel(prev => Math.min(prev + 1, 20))}
              className="p-2 hover:bg-blue-100 rounded transition"
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5 text-blue-600" />
            </button>
            <button
              onClick={() => setZoomLevel(prev => Math.max(prev - 1, 5))}
              className="p-2 hover:bg-blue-100 rounded transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5 text-blue-600" />
            </button>
          </div>

          {parkingLocation && (
            <div className="absolute bottom-4 left-4 bg-red-50 border-2 border-red-200 rounded-lg shadow-md p-4 max-w-xs">
              <p className="text-sm font-bold text-red-700">🅿️ Your Car</p>
              {currentLocation && (
                <p className="text-sm font-semibold text-red-600 mt-2">
                  {calculateDistance(
                    currentLocation.lat,
                    currentLocation.lng,
                    parkingLocation.lat,
                    parkingLocation.lng
                  )}{' '}
                  miles away
                </p>
              )}
              {parkingPhoto && <p className="text-xs text-green-600 mt-1">📸 Photo saved</p>}
              <button
                onClick={handleClearParking}
                className="mt-2 w-full bg-red-500 hover:bg-red-600 text-white text-xs font-semibold py-1 rounded transition"
              >
                Clear Parking Pin
              </button>
            </div>
          )}
        </div>

        {/* Photo Prompt Modal */}
        {showPhotoPrompt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm">
              <p className="text-lg font-bold text-gray-800 mb-4">Take a photo of your parking spot?</p>
              <p className="text-sm text-gray-600 mb-4">This helps you remember where you parked.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPhotoPrompt(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 rounded-lg transition"
                >
                  Skip
                </button>
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  Take Photo
                </button>
              </div>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="flex gap-2 mb-3">
            <button
              onClick={handlePinCar}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
            >
              <MapPin className="w-5 h-5" />
              PARK MY CAR
            </button>

            <button
              onClick={handleAddLocation}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
            >
              <MapPin className="w-5 h-5" />
              Save Location
            </button>
          </div>

          <div className="text-center text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
            <p className="text-xs">💡 Tap "PARK MY CAR" to pin your location</p>
          </div>
        </div>

        {/* Saved Locations */}
        <div className="bg-gray-50 border-t border-gray-200 max-h-32 overflow-y-auto">
          {savedLocations.length > 0 && (
            <div className="p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">📍 Saved Locations</p>
              <div className="space-y-2">
                {savedLocations.map((loc) => (
                  <div key={loc.id} className="bg-white p-2 rounded flex justify-between items-center">
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-gray-800">{loc.label}</p>
                      {currentLocation && (
                        <p className="text-xs text-gray-500">
                          {calculateDistance(
                            currentLocation.lat,
                            currentLocation.lng,
                            loc.latitude,
                            loc.longitude
                          )}{' '}
                          mi
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteLocation(loc.id)}
                      className="p-1 hover:bg-red-100 text-red-500 rounded transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // SETTINGS SCREEN
  if (screen === 'settings') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
          <button
            onClick={() => setScreen('map')}
            className="text-blue-500 hover:text-blue-600 font-semibold mb-2"
          >
            ← Back
          </button>
          <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="font-semibold text-gray-800 mb-3">Status</h3>
            <div className="text-sm text-gray-600">
              <p className="mb-2">
                {isOnline ? (
                  <span className="text-green-600 font-semibold">🟢 Online</span>
                ) : (
                  <span className="text-red-600 font-semibold">🔴 Offline</span>
                )}
              </p>
              {isSyncing && <p className="text-blue-600">⏳ Syncing with cloud...</p>}
              <p className="text-xs mt-2">Trial: {trialDaysLeft} days left</p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="font-semibold text-gray-800 mb-3">Cache</h3>
            <p className="text-sm text-gray-600 mb-3">
              Your data is cached locally. When online, it syncs automatically to the cloud.
            </p>
            <button
              onClick={() => {
                localStorage.removeItem('parkItPinItCache');
                alert('Cache cleared');
              }}
              className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 rounded-lg transition"
            >
              Clear Local Cache
            </button>
          </div>

          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="font-semibold text-gray-800 mb-3">About</h3>
            <p className="text-sm text-gray-600">Park-It-Pin-It v2.0</p>
            <p className="text-xs text-gray-500 mt-2">Smart location pinning with offline support.</p>
          </div>
        </div>
      </div>
    );
  }
}
