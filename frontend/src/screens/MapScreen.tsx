
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Linking, Platform } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, MapPin, Building2, List, Navigation } from 'lucide-react-native';
import { ManualDataService } from '../services/ManualDataService';

// Static coordinates for demo purposes
const CITY_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
    'Mumbai': { latitude: 19.0760, longitude: 72.8777 },
    'Bangalore': { latitude: 12.9716, longitude: 77.5946 },
    'Bengaluru': { latitude: 12.9716, longitude: 77.5946 },
    'Delhi': { latitude: 28.7041, longitude: 77.1025 },
    'New Delhi': { latitude: 28.6139, longitude: 77.2090 },
    'Hyderabad': { latitude: 17.3850, longitude: 78.4867 },
    'Pune': { latitude: 18.5204, longitude: 73.8567 },
    'Chennai': { latitude: 13.0827, longitude: 80.2707 },
    'Kolkata': { latitude: 22.5726, longitude: 88.3639 },
    'Ahmedabad': { latitude: 23.0225, longitude: 72.5714 },
    'Gurgaon': { latitude: 28.4595, longitude: 77.0266 },
    'Noida': { latitude: 28.5355, longitude: 77.3910 },
    'Remote': { latitude: 20.5937, longitude: 78.9629 }, // Center of India
};

const MapScreen = ({ navigation }: any) => {
    const [jobs, setJobs] = useState<any[]>([]);
    const [clusters, setClusters] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

    const initialRegion = {
        latitude: 20.5937,
        longitude: 78.9629,
        latitudeDelta: 15,
        longitudeDelta: 15,
    };

    useEffect(() => {
        fetchJobs();
    }, []);

    const fetchJobs = async () => {
        setLoading(true);
        try {
            const user = await ManualDataService.getUser();
            const { data } = await ManualDataService.getNearbyJobs('', user?.id);

            // Group by location
            const grouped: Record<string, any[]> = {};

            (data || []).forEach((job: any) => {
                // Normalize location string
                let loc = job.location ? job.location.trim() : 'Remote';
                // Simple matching for city names in string (e.g. "Mumbai, India" -> "Mumbai")
                const cityKey = Object.keys(CITY_COORDINATES).find(city => loc.includes(city));
                const key = cityKey || loc;

                if (!grouped[key]) {
                    grouped[key] = [];
                }
                grouped[key].push(job);
            });

            const clusterArray = Object.keys(grouped).map(key => {
                const coords = CITY_COORDINATES[key] || {
                    // Random offset if unknown location
                    latitude: initialRegion.latitude + (Math.random() - 0.5) * 5,
                    longitude: initialRegion.longitude + (Math.random() - 0.5) * 5
                };
                return {
                    location: key,
                    jobs: grouped[key],
                    coordinate: coords,
                    count: grouped[key].length
                };
            });

            setClusters(clusterArray);
            setJobs(data || []);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleClusterPress = (cluster: any) => {
        setSelectedLocation(cluster.location);
    };

    const handleViewRoute = (latitude: number, longitude: number, label: string) => {
        const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
        const latLng = `${latitude},${longitude}`;
        const url = Platform.select({
            ios: `${scheme}${label}@${latLng}`,
            android: `${scheme}${latLng}(${label})`
        });

        if (url) {
            Linking.openURL(url);
        }
    };


    const filteredJobs = selectedLocation
        ? clusters.find(c => c.location === selectedLocation)?.jobs || []
        : jobs;

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.headerContainer} edges={['top']}>
                <View style={styles.header}>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>Job Map</Text>
                        <Text style={styles.headerSubtitle}>{jobs.length} Active Jobs</Text>
                    </View>
                    <View style={{ width: 24 }} />
                </View>
            </SafeAreaView>

            <View style={styles.mapContainer}>
                <MapView style={styles.map} initialRegion={initialRegion}>
                    {clusters.map((cluster, index) => (
                        <Marker
                            key={index}
                            coordinate={cluster.coordinate}
                            onPress={() => handleClusterPress(cluster)}
                        >
                            <View style={styles.clusterMarker}>
                                <Text style={styles.clusterCount}>{cluster.count}</Text>
                            </View>
                            <Callout
                                tooltip
                                onPress={() => handleViewRoute(cluster.coordinate.latitude, cluster.coordinate.longitude, cluster.location)}
                            >
                                <View style={styles.calloutContainer}>
                                    <Text style={styles.calloutTitle}>{cluster.location}</Text>
                                    <Text style={styles.calloutSubtitle}>{cluster.count} Jobs Available</Text>
                                    <View style={styles.calloutAction}>
                                        <Text style={styles.calloutActionText}>Tap to View Route</Text>
                                    </View>
                                </View>
                            </Callout>
                        </Marker>
                    ))}
                </MapView>
            </View>

            <View style={styles.listContainer}>
                <View style={styles.listHeader}>
                    <View>
                        <Text style={styles.listTitle}>
                            {selectedLocation ? `Jobs in ${selectedLocation}` : 'All Jobs'}
                        </Text>
                        {selectedLocation && (
                            <TouchableOpacity
                                style={styles.viewRouteButton}
                                onPress={() => {
                                    const cluster = clusters.find(c => c.location === selectedLocation);
                                    if (cluster) {
                                        handleViewRoute(cluster.coordinate.latitude, cluster.coordinate.longitude, cluster.location);
                                    }
                                }}
                            >
                                <Navigation size={14} color="#2563EB" />
                                <Text style={styles.viewRouteText}>View Route</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {selectedLocation && (
                        <TouchableOpacity onPress={() => setSelectedLocation(null)}>
                            <Text style={styles.clearFilterText}>Show All</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 20 }} />
                ) : (
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {filteredJobs.map((job: any) => (
                            <TouchableOpacity
                                key={job.id}
                                style={styles.companyCard}
                                onPress={() => navigation.navigate('JobDetails', { job })}
                            >
                                <View style={styles.companyIconBox}>
                                    <Text style={styles.companyInitials}>{(job.company_name || 'CO').substring(0, 2).toUpperCase()}</Text>
                                </View>
                                <View style={styles.companyInfo}>
                                    <Text style={styles.companyName}>{job.title}</Text>
                                    <View style={styles.metaRow}>
                                        <Text style={styles.metaText}>{job.company_name}</Text>
                                        <Text style={styles.dotSeparator}>•</Text>
                                        <Text style={styles.metaText}>{job.location || 'Remote'}</Text>
                                    </View>
                                </View>
                                <View style={styles.jobsBadge}>
                                    <MapPin size={12} color="#2563EB" />
                                </View>
                            </TouchableOpacity>
                        ))}
                        {filteredJobs.length === 0 && (
                            <Text style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 20 }}>No jobs found in this area.</Text>
                        )}
                    </ScrollView>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    headerContainer: {
        backgroundColor: '#fff',
        zIndex: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    headerTextContainer: {
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#6B7280',
    },
    mapContainer: {
        height: Dimensions.get('window').height * 0.45,
        width: '100%',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    clusterMarker: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#2563EB',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    clusterCount: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    calloutContainer: {
        backgroundColor: 'white',
        padding: 10,
        borderRadius: 8,
        width: 150,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
        marginBottom: 5,
    },
    calloutTitle: {
        fontWeight: 'bold',
        fontSize: 14,
        marginBottom: 4,
    },
    calloutSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    calloutAction: {
        marginTop: 4,
        paddingTop: 4,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        width: '100%',
        alignItems: 'center',
    },
    calloutActionText: {
        fontSize: 12,
        color: '#2563EB',
        fontWeight: '600',
    },
    listContainer: {
        flex: 1,
        backgroundColor: '#fff',
        marginTop: -20,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 24,
        paddingHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    listHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    listTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 4,
    },
    viewRouteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    viewRouteText: {
        fontSize: 13,
        color: '#2563EB',
        fontWeight: '500',
    },
    clearFilterText: {
        color: '#6B7280',
        fontSize: 14,
        fontWeight: '500',
        marginTop: 2,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    companyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#F3F4F6',
        borderRadius: 16,
        marginBottom: 12,
    },
    companyIconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    companyInitials: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#4B5563',
    },
    companyInfo: {
        flex: 1,
    },
    companyName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaText: {
        fontSize: 12,
        color: '#6B7280',
    },
    dotSeparator: {
        marginHorizontal: 6,
        color: '#D1D5DB',
        fontSize: 12,
    },
    jobsBadge: {
        backgroundColor: '#EFF6FF',
        padding: 8,
        borderRadius: 20,
    },
});

export default MapScreen;
