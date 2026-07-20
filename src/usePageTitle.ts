import { useEffect } from 'react';
import { Platform } from 'react-native';

export default function usePageTitle(title: string) {
  useEffect(() => {
    if (Platform.OS === 'web') {
      document.title = `EscalarML — ${title}`;
    }
  }, [title]);
}
