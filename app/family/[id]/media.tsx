import { useLocalSearchParams } from 'expo-router';

import BackButton from '../../../src/components/BackButton';
import { MediaScreen } from '../../(tabs)/media';

export default function FamilyMediaRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <>
    <BackButton label="Family workspace" fallback={`/family/${id}`} />
    <MediaScreen familyIdOverride={id} />
  </>;
}