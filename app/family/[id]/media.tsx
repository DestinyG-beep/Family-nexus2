import { useLocalSearchParams } from 'expo-router';

import { MediaScreen } from '../../(tabs)/media';

export default function FamilyMediaRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <MediaScreen familyIdOverride={id} />;
}