import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Mic, MicOff, Trash2, Settings, LogOut, ZoomIn, ZoomOut } from 'lucide-react';

export default function ParkItPinIt() {
  const [user, setUser] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [parkingLocation, setParkingLocation] = useState(null);
  const [savedLocations, setSavedLocations] = useState([]);
  const [screen, setScreen] = useState('map');
  const [isListening, setIsListening] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState(14);
  const [zoomLevel, setZoomLevel] = useState(1);
  const recognitionRef = useRef(null);
  const mapCanvasRef = useRef(null);

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
  }, [currentLocation]);

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

  // Draw map with zoom
  useEffect(() => {
    if (mapCanvasRef.current && currentLocation) {
      const canvas = mapCanvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Clear canvas
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid (street-like appearance)
      ctx.strokeStyle = '#bfdbfe';
      ctx.lineWidth = 1;
      const gridSize = 40 / zoomLevel;
      for (let i = 0; i < canvas.width; i += gridSize) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Draw current location (user position)
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 12 * zoomLevel, 0, Math.PI * 2);
      ctx.fill();
      
      // Add blue glow effect
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 20 * zoomLevel, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      // Draw parking location with large, detailed pin
      if (parkingLocation) {
        const pinX = centerX - (currentLocation.lng - parkingLocation.lng) * 5000 * zoomLevel;
        const pinY = centerY - (currentLocation.lat - parkingLocation.lat) * 5000 * zoomLevel;

        if (pinX > -50 && pinX < canvas.width + 50 && pinY > -50 && pinY < canvas.height + 50) {
          // Draw large red pin with shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.beginPath();
          ctx.arc(pinX + 3, pinY + 3, 20 * zoomLevel, 0, Math.PI * 2);
          ctx.fill();

          // Main red pin
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(pinX, pinY, 20 * zoomLevel, 0, Math.PI * 2);
          ctx.fill();
          
          // White P in center
          ctx.fillStyle = 'white';
          ctx.font = `bold ${20 * zoomLevel}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('P', pinX, pinY);

          // Distance label below pin
          if (currentLocation) {
            const dist = calculateDistance(currentLocation.lat, currentLocation.lng, parkingLocation.lat, parkingLocation.lng);
            ctx.fillStyle = '#1f2937';
            ctx.font = `bold ${12 * zoomLevel}px Arial`;
            ctx.fillText(`${dist} mi`, pinX, pinY + 35 * zoomLevel);
          }
        }
      }

      // Draw saved locations
      savedLocations.forEach((loc) => {
        const locX = centerX - (currentLocation.lng - loc.lng) * 5000 * zoomLevel;
        const locY = centerY - (currentLocation.lat - loc.lat) * 5000 * zoomLevel;

        if (locX > -50 && locX < canvas.width + 50 && locY > -50 && locY < canvas.height + 50) {
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(locX, locY, 15 * zoomLevel, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#fff';
          ctx.font = `bold ${14 * zoomLevel}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('L', locX, locY);
        }
      });

      // Draw compass
      ctx.fillStyle = '#6366f1';
      ctx.font = `bold ${16 * zoomLevel}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('N', centerX, 30);
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX, 40);
      ctx.lineTo(centerX, 20);
      ctx.stroke();
    }
  }, [currentLocation, parkingLocation, savedLocations, zoomLevel]);

  const handlePinCar = () => {
    if (!currentLocation) return;

    setIsAnimating(true);
    setParkingLocation(currentLocation);

    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance('Done!');
    utterance.rate = 1;
    synth.speak(utterance);

    setTimeout(() => {
      setIsAnimating(false);
    }, 2000);
  };

  const handleAddLocation = () => {
    if (!currentLocation) return;
    const name = prompt('Name this location:');
    if (name) {
      setSavedLocations([...savedLocations, { ...currentLocation, name, id: Date.now() }]);
    }
  };

  const handleDeleteLocation = (id) => {
    setSavedLocations(savedLocations.filter(loc => loc.id !== id));
  };

  const handleClearParking = () => {
    setParkingLocation(null);
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

  const handleLogin = () => {
    setUser({ email: 'user@example.com', name: 'Test User' });
    setScreen('map');
  };

  const handleLogout = () => {
    setUser(null);
    setScreen('map');
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
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
            <h1 className="text-3xl font-bold text-gray-800">Park-It-Pin-It</h1>
          </div>

          <p className="text-gray-600 text-center mb-8 text-sm">
            Never lose your car in a parking lot again. Voice-activated parking pin technology.
          </p>

          <button
            onClick={handleLogin}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 rounded-lg transition mb-4 flex items-center justify-center"
          >
            Sign In
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
              Park-It-Pin-It
            </h1>
            <button
              onClick={() => setScreen('settings')}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <Settings className="w-6 h-6 text-gray-600" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Trial: {trialDaysLeft} days left | Zoom: {(zoomLevel).toFixed(1)}x</p>
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

          {/* Zoom Controls */}
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md p-2 flex flex-col gap-2">
            <button
              onClick={handleZoomIn}
              className="p-2 hover:bg-blue-100 rounded transition"
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5 text-blue-600" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 hover:bg-blue-100 rounded transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5 text-blue-600" />
            </button>
          </div>

          <div className="absolute top-4 left-4 bg-white rounded-lg shadow-md p-3">
            <p className="text-xs text-gray-600">Your Location</p>
            {currentLocation && (
              <p className="text-sm font-mono text-gray-800">
                {currentLocation.lat.toFixed(5)}, {currentLocation.lng.toFixed(5)}
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
            <p className="font-semibold mb-1">💬 Say: "Hey, Park-It-Pin-It, pin it"</p>
            <p className="text-xs">Click the button above and speak to park your car location</p>
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
                      <p className="font-semibold text-sm text-gray-800">{loc.name}</p>
                      {currentLocation && (
                        <p className="text-xs text-gray-500">
                          {calculateDistance(currentLocation.lat, currentLocation.lng, loc.lat, loc.lng)} mi
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
              onClick={handleLogout}
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
            <p className="text-sm text-gray-600 mb-2">Park-It-Pin-It v1.0</p>
            <p className="text-xs text-gray-500">Never lose your car again. Voice-activated parking for everyone.</p>
          </div>
        </div>
      </div>
    );
  }
}
