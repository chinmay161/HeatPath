import { Link, Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme/colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Page not found</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.canvas },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  link: { marginTop: 16 },
  linkText: { fontFamily: fonts.uiBold, color: colors.forest, fontSize: 15 },
});
