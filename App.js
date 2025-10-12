import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Mic, MicOff, Trash2, Settings, LogOut, CreditCard } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

// REPLACE THIS WITH YOUR FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export default function ParkNPin() {
  const [user, setUser] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [parkingLocation, setParkingLocation] = useState(null);
  const [savedLocations, setSavedLocations] = useState([]);
  const [screen, setScreen] = useState('map');
  const [isListening, setIsListening] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState(14);
  const [showPromoCode, setShowPromoCode] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [loading, setLoading] = useState(false);
  const recognitionRef = useRef(null);
  const mapCanvasRef = useRef(null);

  // Initialize Firebase Auth
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        setUser({
          email: firebaseUser.email,
          name: firebaseUser.displayName || firebaseUser.email,
          uid: firebaseUser.uid
        });
        loadUserData(firebaseUser.uid);
      } else {
        setUser(null);
        setSavedLocations([]);
        setParkingLocation(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load user data from Firestore
  const loadUserData = async (uid) => {
    try {
      const locationsRef = collection(db, 'users', uid, 'locations');
      const q = query(locationsRef);
      const snapshot = await getDocs(q);
      const locations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSavedLocations(locations);

      // Check for active parking pin
      const parkingPin = locations.find(loc => loc.category === 'parking' && loc.isActive);
      if (parkingPin) {
        setParkingLocation({
          lat: parkingPin.latitude,
          lng: parkingPin.longitude
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => setIsListening(false);

      recognitionRef.current.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript = event.results[i][0].transcript.toLowerCase().trim();
          }
        }

        if (transcript.includes('pin it')) {
          handlePinCar();
        }
      };
    }
  }, [currentLocation, user]);

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

  // Draw map
  useEffect(() => {
    if (mapCanvasRef.current && currentLocation) {
      const canvas = mapCanvasRef.current;
      const ctx = canvas.getContext('2d');
      
      ctx.fillStyle = '#f0f9ff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#e0e7ff';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
      ctx.fill();

      if (parkingLocation) {
        const pinX = centerX - (currentLocation.lng - parkingLocation.lng) * 1000;
        const pinY = centerY - (currentLocation.lat - parkingLocation.lat) * 1000;

        if (pinX > 0 && pinX < canvas.width && pinY > 0 && pinY < canvas.height) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(pinX, pinY, 10, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = 'white';
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('P', pinX, pinY);
        }
      }

      savedLocations.forEach((loc) => {
        const locX = centerX - (currentLocation.lng - loc.longitude) * 1000;
        const locY = centerY - (currentLocation.lat - loc.latitude) * 1000;

        if (locX > 0 && locX < canvas.width && locY > 0 && locY < canvas.height) {
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(locX, locY, 8, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('L', locX, locY);
        }
      });

      ctx.fillStyle = '#6366f1';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('N', centerX, 20);
    }
  }, [currentLocation, parkingLocation, savedLocations]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      alert('Sign-in failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setScreen('map');
    } catch (error) {
      alert('Sign-out failed: ' + error.message);
    }
  };

  const handlePinCar = async () => {
    if (!currentLocation || !user) return;

    setIsAnimating(true);
    setParkingLocation(currentLocation);

    try {
      // Clear previous parking pin
      const oldParkingPins = savedLocations.filter(loc => loc.category === 'parking' && loc.isActive);
      for (const pin of oldParkingPins) {
        await deleteDoc(doc(db, 'users', user.uid, 'locations', pin.id));
      }

      // Add new parking pin
      await addDoc(collection(db, 'users', user.uid, 'locations'), {
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        label: 'My Car',
        category: 'parking',
        isActive: true,
        timestamp: new Date(),
        address: `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`
      });

      // Reload data
      loadUserData(user.uid);

      // Play audio
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance('Done!');
      synth.speak(utterance);
    } catch (error) {
      console.error('Error pinning car:', error);
      alert('Failed to save parking location');
    }

    setTimeout(() => {
      setIsAnimating(false);
    }, 2000);
  };

  const handleAddLocation = async () => {
    if (!currentLocation || !user) return;
    const name = prompt('Name this location:');
    if (name) {
      try {
        await addDoc(collection(db, 'users', user.uid, 'locations'), {
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          label: name,
          category: 'custom',
          isActive: false,
          timestamp: new Date(),
          address: `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`
        });
        loadUserData(user.uid);
      } catch (error) {
        console.error('Error adding location:', error);
        alert('Failed to save location');
      }
    }
  };

  const handleDeleteLocation = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'locations', id));
      loadUserData(user.uid);
    } catch (error) {
      console.error('Error deleting location:', error);
    }
  };

  const handleClearParking = async () => {
    if (!user) return;
    try {
      const parkingPin = savedLocations.find(loc => loc.category === 'parking' && loc.isActive);
      if (parkingPin) {
        await deleteDoc(doc(db, 'users', user.uid, 'locations', parkingPin.id));
        loadUserData(user.uid);
      }
    } catch (error) {
      console.error('Error clearing parking:', error);
    }
  };

  const handleStartListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.log('Already listening');
      }
    }
  };

  const handleStopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
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
            <h1 className="text-3xl font-bold text-gray-800">Park-N-Pin</h1>
          </div>

          <p className="text-gray-600 text-center mb-8 text-sm">
            Never lose your car in a parking lot again. Voice-activated parking pin technology.
          </p>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 rounded-lg transition mb-4 flex items-center justify-center disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In with Google'}
          </button>

          <div className="border-t pt-4">
            <p className="text-xs text-gray-500 text-center">
              <strong>Try Now:</strong> Start with a free 14-day trial. No credit card required.
            </p>
          </div>

          <div className="mt-6 bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-800 text-sm mb-2">✨ Key Features:</h3>
            <ul className="text-xs text-gray-700 space-y-1">
              <li>✓ Voice-activated parking pin</li>
              <li>✓ Save multiple locations</li>
              <li>✓ Real-time navigation</li>
              <li>✓ Works offline</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // MAP SCREEN
  if (screen === 'map') {
    return (
      <div className="h-screen w-full bg-gradient-to-b from-white to-blue-50 flex flex-col">
        <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center">
              <MapPin className="w-6 h-6 text-red-500 mr-2" />
              Park-N-Pin
            </h1>
            <button
              onClick={() => setScreen('settings')}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <Settings className="w-6 h-6 text-gray-600" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Trial: {trialDaysLeft} days left</p>
        </div>

        <div className="flex-1 relative overflow-hidden bg-blue-100">
          <canvas
            ref={mapCanvasRef}
            width={window.innerWidth}
            height={window.innerHeight - 300}
            className="w-full h-full"
          />

          {isAnimating && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 backdrop-blur-sm">
              <div className="bg-white rounded-2xl p-8 shadow-2xl text-center">
                <div className="mb-4 text-6xl">✋</div>
                <div className="text-4xl mb-4 animate-pulse">📍</div>
                <p className="text-xl font-bold text-gray-800">Parking pinned!</p>
                <p className="text-gray-600 text-sm mt-2">Your car location is saved</p>
              </div>
            </div>
          )}

          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md p-3">
            <p className="text-xs text-gray-600">Current Location</p>
            {currentLocation && (
              <p className="text-sm font-mono text-gray-800">
                {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
              </p>
            )}
          </div>

          {parkingLocation && (
            <div className="absolute bottom-4 left-4 bg-red-50 border-2 border-red-200 rounded-lg shadow-md p-4 max-w-xs">
              <p className="text-sm font-bold text-red-700">🅿️ Your Car</p>
              {currentLocation && (
                <p className="text-sm font-semibold text-red-600 mt-2">
                  {calculateDistance(currentLocation.lat, currentLocation.lng, parkingLocation.lat, parkingLocation.lng)} miles away
                </p>
              )}
              <button
                onClick={handleClearParking}
                className="mt-2 w-full bg-red-500 hover:bg-red-600 text-white text-xs font-semibold py-1 rounded transition"
              >
                Clear Parking Pin
              </button>
            </div>
          )}
        </div>

        <div className="bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="flex gap-2 mb-3">
            <button
              onClick={handleStartListening}
              className={`flex-1 ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-blue-500 hover:bg-blue-600'
              } text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-5 h-5" />
                  Stop Listening
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5" />
                  Start Listening
                </>
              )}
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
            <p className="font-semibold mb-1">💬 Say: "Hey, Park-N-Pin, pin it"</p>
            <p className="text-xs">Hold the button above and speak to park your car location</p>
          </div>
        </div>

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
                          {calculateDistance(currentLocation.lat, currentLocation.lng, loc.latitude, loc.longitude)} mi
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
            <h3 className="font-semibold text-gray-800 mb-3">Account</h3>
            <div className="text-sm text-gray-600 mb-3">
              <p className="font-semibold">{user.name}</p>
              <p className="text-xs">{user.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>

          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="font-semibold text-gray-800 mb-3">Subscription</h3>
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg mb-3">
              <p className="text-sm font-semibold text-blue-900">Free Trial</p>
              <p className="text-xs text-blue-700 mt-1">{trialDaysLeft} days remaining</p>
            </div>
            <button className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 rounded-lg transition">
              Upgrade to Premium
            </button>
          </div>

          <div className="bg-white rounded-lg p-4 shadow">
            <h3 className="font-semibold text-gray-800 mb-3">About</h3>
            <p className="text-sm text-gray-600 mb-2">Park-N-Pin v1.0</p>
            <p className="text-xs text-gray-500">Never lose your car again. Voice-activated parking for everyone.</p>
          </div>
        </div>
      </div>
    );
  }
}
