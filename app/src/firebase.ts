import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCEEf66uWiLNziniI1zbBa_0wHddV0MSyU',
  authDomain: 'vexgridlock.firebaseapp.com',
  projectId: 'vexgridlock',
  storageBucket: 'vexgridlock.firebasestorage.app',
  messagingSenderId: '257376608146',
  appId: '1:257376608146:web:85fd2d36b1685730aaab4b',
  measurementId: 'G-QD8C130SB4',
};

const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
