import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Mic, MicOff, Trash2, Settings, LogOut } from 'lucide-react';

export default function ParkItPinIt() {
  const [user, setUser] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [parkingLocation, setParkingLocation] = useState(null);
  const [savedLocations, setSavedLocations] = useState([]);
  const [screen, setScreen] = useState('map');
  const [isListening, setIsListening] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState(14);
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
        ctx.beginPat
