import React, { useEffect, useState, Platform } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Zap, Gem, Check } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    initConnection,
    endConnection,
    finishTransaction,
    purchaseErrorListener,
    purchaseUpdatedListener,
    approveManagedPurchaseAndroid,
    ProductPurchase,
    PurchaseError,
    SubscriptionPurchase,
    getIds,
    getSubscriptions,
    requestSubscription,
    acknowledgePurchaseAndroid,
    flushFailedPurchasesCachedAsPendingAndroid,
} from 'react-native-iap';

const { width } = Dimensions.get('window');

// SKUs from your Kotlin code
const subscriptionSkus = Platform.select({
    android: ['univault_premium_subscription'],
    default: [],
});

const testSkus = Platform.select({
    android: ['android.test.purchased'], // Google Play Test Product
    default: [],
});

const SubscriptionScreen = ({ navigation }: any) => {
    const [loading, setLoading] = useState(false);
    const [realSubscriptionAvailable, setRealSubscriptionAvailable] = useState(false);
    const [testProductAvailable, setTestProductAvailable] = useState(false);

    useEffect(() => {
        let purchaseUpdateSubscription: any = null;
        let purchaseErrorSubscription: any = null;

        const initializeIAP = async () => {
            try {
                await initConnection();
                if (Platform.OS === 'android') {
                    await flushFailedPurchasesCachedAsPendingAndroid();
                }

                // Listeners
                purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase: SubscriptionPurchase | ProductPurchase) => {
                    const receipt = purchase.transactionReceipt;
                    if (receipt) {
                        try {
                            if (Platform.OS === 'android') {
                                // Acknowledge the purchase (replicating handlePurchase -> acknowledgePurchase in Kotlin)
                                await acknowledgePurchaseAndroid({ token: purchase.purchaseToken, developerPayload: purchase.developerPayloadAndroid });
                            } else {
                                await finishTransaction({ purchase, isConsumable: false });
                            }
                            // Success!
                            await onSubscriptionSuccess();
                        } catch (ackErr) {
                            console.warn('ackErr', ackErr);
                            // Even if ack fails, if we have receipt, we might want to count it or retry.
                            // But usually ack is required for it to stick.
                        }
                    }
                });

                purchaseErrorSubscription = purchaseErrorListener((error: PurchaseError) => {
                    setLoading(false);
                    console.warn('purchaseErrorListener', error);
                    // Mapped somewhat to your Kotlin error handling logic
                    if (error.responseCode === 1) { // User canceled
                        // Silent or handled
                    } else {
                        Alert.alert('Purchase Failed', error.message);
                    }
                });

                // 1. Try to fetch Real Subscription
                if (subscriptionSkus && subscriptionSkus.length > 0) {
                    try {
                        const subs = await getSubscriptions({ skus: subscriptionSkus });
                        console.log("Subscriptions fetched:", subs);
                        if (subs && subs.length > 0) {
                            setRealSubscriptionAvailable(true);
                        }
                    } catch (subErr) {
                        console.log("Real subscription check failed or empty", subErr);
                    }
                }

                // 2. Fetch Test Product (Fallback)
                if (testSkus && testSkus.length > 0) {
                    try {
                        const products = await getProducts({ skus: testSkus });
                        console.log("Test products fetched:", products);
                        if (products && products.length > 0) {
                            setTestProductAvailable(true);
                        }
                    } catch (prodErr) {
                        console.log("Test product check failed", prodErr);
                    }
                }

            } catch (err) {
                console.warn(err);
            }
        };

        initializeIAP();

        return () => {
            if (purchaseUpdateSubscription) {
                purchaseUpdateSubscription.remove();
                purchaseUpdateSubscription = null;
            }
            if (purchaseErrorSubscription) {
                purchaseErrorSubscription.remove();
                purchaseErrorSubscription = null;
            }
            endConnection();
        };
    }, []);

    const onSubscriptionSuccess = async () => {
        setLoading(false);
        try {
            await AsyncStorage.setItem('is_premium_user', 'true');
            await AsyncStorage.setItem('subscription_time', Date.now().toString());

            Alert.alert(
                "Subscription Successful!",
                "Welcome to Premium!",
                [{ text: "OK", onPress: () => navigation.replace('AddSkills') }]
            );
        } catch (e) {
            console.error(e);
        }
    };

    const handleSubscribe = async () => {
        setLoading(true);
        try {
            if (realSubscriptionAvailable && subscriptionSkus && subscriptionSkus.length > 0) {
                // Use Real Subscription
                await requestSubscription({ sku: subscriptionSkus[0] });
            } else if (testProductAvailable && testSkus && testSkus.length > 0) {
                // Use Test Product (In-App Purchase flow, not subscription)
                console.log("Using Test SKU");
                await requestPurchase({ sku: testSkus[0] });
            } else {
                setLoading(false);
                // Force try test sku if logic fails but user clicked (development fallback)
                // or show detailed error
                if (__DEV__) {
                    await requestPurchase({ sku: 'android.test.purchased' });
                    return;
                }

                Alert.alert(
                    "Setup Required",
                    "Real subscription not found. To test, please ensure you are in the Internal Test Track on Play Console."
                );
            }
        } catch (err: any) {
            setLoading(false);
            console.warn(err.code, err.message);
            if (err.code === 'E_USER_CANCELLED') {
                // User cancelled
            } else {
                Alert.alert(
                    "Subscription Error",
                    "Could not start subscription. Make sure you are signed in to the Play Store."
                );
            }
        }
    };

    const handleSkip = () => {
        navigation.replace('AddSkills');
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Gradient Background Overlay - approximate */}
                <LinearGradient
                    colors={['#1F2937', '#0A0E27']}
                    style={styles.gradientOverlay}
                />

                <View style={styles.contentContainer}>
                    {/* Floating Logo Container */}
                    <View style={styles.logoCard}>
                        <View style={styles.logoInner}>
                            {/* Placeholder for App Logo - using Text for now or basic Icon */}
                            <Text style={styles.logoText}>SM</Text>
                            <Text style={styles.sparkle}>✨</Text>
                        </View>
                    </View>

                    {/* Title Section */}
                    <Text style={styles.titleText}>SkillMatch Premium</Text>
                    <View style={styles.premiumBadgeContainer}>
                        <Text style={styles.premiumBadgeText}>PREMIUM</Text>
                    </View>

                    <Text style={styles.subtitleText}>
                        Unlock unlimited potential with premium features designed for your success
                    </Text>

                    {/* Features Container */}
                    <View style={styles.featuresContainer}>

                        {/* Feature Card 1: Ad-Free */}
                        <View style={styles.featureCard}>
                            <Text style={styles.featureIcon}>⚡</Text>
                            <View style={styles.featureTextParams}>
                                <Text style={styles.featureTitle}>Ad-Free Experience</Text>
                                <Text style={styles.featureSubtitle}>Pure learning, no interruptions</Text>
                            </View>
                            <Check size={24} color="#4CAF50" strokeWidth={3} />
                        </View>

                        {/* Feature Card 2: Exclusive Tools */}
                        <View style={styles.featureCard}>
                            <Text style={styles.featureIcon}>💎</Text>
                            <View style={styles.featureTextParams}>
                                <Text style={styles.featureTitle}>Exclusive Tools</Text>
                                <Text style={styles.featureSubtitle}>Advanced analytics, insights</Text>
                            </View>
                            <Check size={24} color="#4CAF50" strokeWidth={3} />
                        </View>

                    </View>

                    {/* Price Card */}
                    <View style={styles.priceCard}>
                        <Text style={styles.priceText}>₹499 / Year</Text>
                        <Text style={styles.priceSubtitle}>Best Value Offer</Text>
                    </View>

                    {/* Subscribe Button */}
                    <TouchableOpacity
                        style={[styles.subscribeButton, loading && { opacity: 0.7 }]}
                        onPress={handleSubscribe}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="black" />
                        ) : (
                            <>
                                <Text style={styles.subscribeButtonText}>Start Premium</Text>
                                <Zap size={20} color="black" fill="black" />
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Terms Text */}
                    <Text style={styles.termsText}>
                        By continuing, you agree to our Terms & Privacy Policy
                    </Text>

                    {/* Spacer */}
                    <View style={{ height: 60 }} />

                    {/* Skip Button */}
                    <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                        <Text style={styles.skipButtonText}>Maybe later</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0E27',
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 40,
    },
    gradientOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 400,
    },
    contentContainer: {
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
    },
    logoCard: {
        width: 120,
        height: 120,
        backgroundColor: 'white',
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 24,
        marginBottom: 24,
    },
    logoInner: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    logoText: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#2563EB',
    },
    sparkle: {
        fontSize: 28,
        position: 'absolute',
        top: 10,
        right: 10,
    },
    titleText: {
        fontSize: 28, // Scaled down slightly from XML 36sp
        fontWeight: 'bold',
        color: 'white',
        letterSpacing: 0.5,
        textAlign: 'center',
    },
    premiumBadgeContainer: {
        marginTop: 8,
        backgroundColor: 'rgba(255, 215, 0, 0.1)', // Gold tint bg
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 4,
    },
    premiumBadgeText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#FFD700', // Gold
        letterSpacing: 1.5,
    },
    subtitleText: {
        fontSize: 16,
        color: '#B8C5D6',
        textAlign: 'center',
        marginTop: 16,
        marginHorizontal: 12,
        lineHeight: 24,
    },
    featuresContainer: {
        width: '100%',
        marginTop: 40,
        gap: 12,
    },
    featureCard: {
        backgroundColor: '#1A1F3A',
        borderRadius: 20,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    featureIcon: {
        fontSize: 28,
        width: 48,
        textAlign: 'center',
    },
    featureTextParams: {
        flex: 1,
        marginLeft: 16,
    },
    featureTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: 'white',
    },
    featureSubtitle: {
        fontSize: 14,
        color: '#7C8AA8',
        marginTop: 4,
    },
    priceCard: {
        width: '100%',
        backgroundColor: '#6C5CE7',
        borderRadius: 24,
        padding: 24,
        marginTop: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 12,
    },
    priceText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
    },
    priceSubtitle: {
        fontSize: 14,
        color: 'white',
        opacity: 0.8,
        marginTop: 4,
    },
    subscribeButton: {
        width: '100%',
        height: 64,
        backgroundColor: 'white',
        borderRadius: 32,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 12,
        gap: 8,
    },
    subscribeButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'black',
    },
    termsText: {
        marginTop: 16,
        fontSize: 12,
        color: '#7C8AA8',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    skipButton: {
        paddingVertical: 16,
        paddingHorizontal: 32,
    },
    skipButtonText: {
        fontSize: 14,
        color: '#7C8AA8',
        textTransform: 'lowercase', // "Maybe later" style
    },
});

export default SubscriptionScreen;
