import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import MapView, {
  Marker as MapMarker,
  Polygon as MapPolygon,
  Polyline as MapPolyline,
  PROVIDER_GOOGLE,
  type MapPressEvent,
} from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import type { RootStackParamList } from '../../../navigation/types';
import type { MerchantShop } from '../../../services/merchant/shopService';
import type { DeliveryArea, LatLngLiteral } from '../../../types/delivery';
import { useDeliveryAreas, useSaveDeliveryAreas } from '../../../hooks/merchant/useDeliveryAreas';
import { overlapsExisting } from '../../../utils/polygons';
import ShopIcon from '../../../icons/ShopIcon';
import GeolocateIcon from '../../../icons/GeolocateIcon';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

type ManageDeliveryAreasRoute = RouteProp<RootStackParamList, 'ManageDeliveryAreas'>;

type LocalArea = {
  id?: string;
  label: string;
  coordinates: LatLngLiteral[];
};

const getDefaultLabel = (index: number) => `Zone ${index + 1}`;

const TAP_MAX_DURATION_MS = 400;
const TAP_MAX_DISTANCE_PX = 24;

function parseCoordinate(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeAreas(areas: LocalArea[]) {
  return areas.map((area) => ({
    label: area.label,
    coordinates: area.coordinates.map((point) => ({
      latitude: Number(point.latitude.toFixed(6)),
      longitude: Number(point.longitude.toFixed(6)),
    })),
  }));
}

export default function ManageDeliveryAreasScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Navigation>();
  const { shop } = useRoute<ManageDeliveryAreasRoute>().params;

  const { data: savedAreas = [], isLoading } = useDeliveryAreas(shop.id);
  const saveMutation = useSaveDeliveryAreas(shop.id);

  const [areas, setAreas] = useState<LocalArea[]>([]);
  const [editingVertices, setEditingVertices] = useState<LatLngLiteral[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [persistedSnapshot, setPersistedSnapshot] = useState<string>('[]');
  const [hasCenteredOnShop, setHasCenteredOnShop] = useState(false);
  const [showShopCallout, setShowShopCallout] = useState(true);
  const [showShopNameLabel, setShowShopNameLabel] = useState(false);

  const mapRef = useRef<MapView | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; timestamp: number } | null>(null);

  const parsedLatitude = parseCoordinate(shop.latitude);
  const parsedLongitude = parseCoordinate(shop.longitude);
  const hasValidLocation = parsedLatitude !== null && parsedLongitude !== null;

  const mapInitialRegion = useMemo(() => {
    const fallbackLatitude = 33.6844;
    const fallbackLongitude = 73.0479;
    const latitude = hasValidLocation && parsedLatitude !== null ? parsedLatitude : fallbackLatitude;
    const longitude = hasValidLocation && parsedLongitude !== null ? parsedLongitude : fallbackLongitude;
    // More zoomed in for better street view (0.005 = street level, 0.01 = neighborhood level)
    const delta = hasValidLocation ? 0.012 : 0.2;

    return {
      latitude,
      longitude,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
  }, [hasValidLocation, parsedLatitude, parsedLongitude]);

  useEffect(() => {
    setHasCenteredOnShop(false);
  }, [mapInitialRegion.latitude, mapInitialRegion.longitude]);

  // Auto-hide shop callout after 4 seconds
  useEffect(() => {
    if (showShopCallout) {
      const timer = setTimeout(() => {
        setShowShopCallout(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showShopCallout]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const mapped = savedAreas.map((area, index) => ({
      id: area.id,
      label: area.label || getDefaultLabel(index),
      coordinates: area.coordinates,
    }));

    const snapshot = JSON.stringify(normalizeAreas(mapped));
    if (snapshot === persistedSnapshot) {
      return;
    }

    setAreas(mapped);
    setPersistedSnapshot(snapshot);
  }, [isLoading, persistedSnapshot, savedAreas]);

  const currentSnapshot = useMemo(() => JSON.stringify(normalizeAreas(areas)), [areas]);
  const hasChanges = currentSnapshot !== persistedSnapshot;

  const shopCoordinate = useMemo(() => {
    if (hasValidLocation && parsedLatitude !== null && parsedLongitude !== null) {
      return { latitude: parsedLatitude, longitude: parsedLongitude };
    }

    return {
      latitude: mapInitialRegion.latitude,
      longitude: mapInitialRegion.longitude,
    };
  }, [hasValidLocation, parsedLatitude, parsedLongitude, mapInitialRegion.latitude, mapInitialRegion.longitude]);

  const addVertexFromCoordinate = useCallback((coordinate: { latitude: number; longitude: number } | null | undefined) => {
    if (!coordinate) {
      return;
    }

    setEditingVertices((prev) => {
      return [...prev, { latitude: coordinate.latitude, longitude: coordinate.longitude }];
    });
  }, []);

  const handleBack = useCallback(() => {
    if (isEditing || hasChanges) {
      Alert.alert(
        t('merchant.delivery.manageAreas.discardTitle'),
        t('merchant.delivery.manageAreas.discardMessage'),
        [
          { text: t('merchant.delivery.manageAreas.keepIt'), style: 'cancel' },
          {
            text: t('merchant.delivery.manageAreas.discard'),
            style: 'destructive',
            onPress: () => navigation.goBack(),
          },
        ]
      );
      return;
    }
    navigation.goBack();
  }, [isEditing, hasChanges, navigation, t]);

  const handleMapPress = useCallback(
    (event: MapPressEvent) => {
      setShowShopNameLabel(false);
      
      if (!isEditing) {
        return;
      }

      const { coordinate } = event.nativeEvent;
      addVertexFromCoordinate(coordinate);
    },
    [isEditing, addVertexFromCoordinate]
  );

  const handleMapTouchStart = useCallback((event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    touchStartRef.current = {
      x: locationX,
      y: locationY,
      timestamp: Date.now(),
    };
  }, []);

  const handleMapTouchEnd = useCallback(
    async (event: GestureResponderEvent) => {
      const start = touchStartRef.current;
      if (!start) {
        setShowShopNameLabel(false);
        return;
      }
      touchStartRef.current = null;

      const endX = event.nativeEvent.locationX;
      const endY = event.nativeEvent.locationY;
      const duration = Date.now() - start.timestamp;
      const distance = Math.hypot(endX - start.x, endY - start.y);

      if (!isEditing) {
        setShowShopNameLabel(false);
        return;
      }

      if (duration > TAP_MAX_DURATION_MS || distance > TAP_MAX_DISTANCE_PX) {
        setShowShopNameLabel(false);
        return;
      }

      if (!mapRef.current) {
        return;
      }

      try {
        const coordinate = await mapRef.current.coordinateForPoint({ x: start.x, y: start.y });
        if (coordinate) {
          addVertexFromCoordinate({ latitude: coordinate.latitude, longitude: coordinate.longitude });
        }
      } catch (error) {
        // Silent fail
      }
    },
    [isEditing, addVertexFromCoordinate]
  );

  const startPolygon = useCallback(() => {
    setEditingVertices([]);
    setIsEditing(true);
  }, []);

  const cancelPolygon = useCallback(() => {
    setEditingVertices([]);
    setIsEditing(false);
  }, []);

  const undoVertex = useCallback(() => {
    setEditingVertices((prev) => prev.slice(0, -1));
  }, []);

  const completePolygon = useCallback(() => {
    if (editingVertices.length < 3) {
      Alert.alert(
        t('merchant.delivery.manageAreas.needMorePoints'),
        t('merchant.delivery.manageAreas.needMorePointsMessage')
      );
      return;
    }

    const existingPolygons = areas.map((area) => area.coordinates);
    if (overlapsExisting(editingVertices, existingPolygons)) {
      Alert.alert(
        t('merchant.delivery.manageAreas.zonesOverlapping'),
        t('merchant.delivery.manageAreas.zonesOverlappingMessage')
      );
      return;
    }

    setAreas((prev) => {
      const next = [
        ...prev,
        {
          id: undefined,
          label: getDefaultLabel(prev.length),
          coordinates: editingVertices,
        },
      ];
      return next;
    });
    setEditingVertices([]);
    setIsEditing(false);
  }, [editingVertices, areas, t]);

  const confirmDeleteArea = useCallback((area: LocalArea) => {
    Alert.alert(
      t('merchant.delivery.manageAreas.removeAreaTitle'),
      t('merchant.delivery.manageAreas.removeAreaMessage'),
      [
        { text: t('merchant.delivery.manageAreas.keepIt'), style: 'cancel' },
        {
          text: t('merchant.delivery.manageAreas.remove'),
          style: 'destructive',
          onPress: () => {
            setAreas((prev) => prev.filter((item) => item !== area));
          },
        },
      ]
    );
  }, [t]);

  const handleSave = useCallback(async () => {
    if (isEditing) {
      Alert.alert(
        t('merchant.delivery.manageAreas.finishOrCancel'),
        t('merchant.delivery.manageAreas.finishOrCancelMessage')
      );
      return;
    }

    try {
      const saved = await saveMutation.mutateAsync(
        areas.map((area) => ({
          label: area.label,
          coordinates: area.coordinates,
        }))
      );

      const nextAreas = saved.map((area: DeliveryArea, index: number) => ({
        id: area.id,
        label: area.label || getDefaultLabel(index),
        coordinates: area.coordinates,
      }));

      setAreas(nextAreas);
      const snapshot = JSON.stringify(normalizeAreas(nextAreas));
      setPersistedSnapshot(snapshot);
      Alert.alert(
        t('merchant.delivery.manageAreas.saved'),
        t('merchant.delivery.manageAreas.savedMessage')
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('merchant.delivery.manageAreas.failedToSaveMessage');
      Alert.alert(t('merchant.delivery.manageAreas.failedToSave'), message);
    }
  }, [areas, isEditing, saveMutation, t]);

  const getZoneColor = useCallback((index: number) => {
    const strokeColors = ['#1d4ed8', '#15803d', '#c2410c', '#7c3aed'];
    const colorIndex = index % strokeColors.length;
    return strokeColors[colorIndex];
  }, []);

  const renderPolygon = useCallback((area: LocalArea, index: number) => {
    const colors = ['#2563eb55', '#22c55e55', '#f9731655', '#a855f755'];
    const strokeColors = ['#1d4ed8', '#15803d', '#c2410c', '#7c3aed'];
    const colorIndex = index % colors.length;

    return (
      <MapPolygon
        key={area.id ? `${area.id}-${index}` : `draft-${index}`}
        coordinates={area.coordinates}
        fillColor={colors[colorIndex]}
        strokeColor={strokeColors[colorIndex]}
        strokeWidth={2}
        tappable={!isEditing}
        onPress={() => {
          setShowShopNameLabel(false);
          if (isEditing) {
            return;
          }
          confirmDeleteArea(area);
        }}
      />
    );
  }, [confirmDeleteArea, isEditing]);

  const handleShopMarkerPress = useCallback(() => {
    setShowShopNameLabel(true);
  }, []);

  const handleGeolocate = useCallback(() => {
    if (!hasValidLocation || !mapRef.current) {
      return;
    }
    mapRef.current.animateToRegion(mapInitialRegion, 500);
  }, [hasValidLocation, mapInitialRegion]);

  const handleMapReady = useCallback(() => {
    if (!hasValidLocation || hasCenteredOnShop) {
      return;
    }
    if (mapRef.current) {
      mapRef.current.animateToRegion(mapInitialRegion, 0);
      setHasCenteredOnShop(true);
    }
  }, [hasCenteredOnShop, hasValidLocation, mapInitialRegion]);

  useEffect(() => {
    if (hasCenteredOnShop || !hasValidLocation || !mapRef.current) {
      return;
    }
    const timeout = setTimeout(() => {
      if (!mapRef.current) {
        return;
      }
      mapRef.current.animateToRegion(mapInitialRegion, 250);
      setHasCenteredOnShop(true);
    }, 200);

    return () => clearTimeout(timeout);
  }, [hasCenteredOnShop, hasValidLocation, mapInitialRegion]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.mapWrapper}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: mapInitialRegion.latitude,
            longitude: mapInitialRegion.longitude,
            latitudeDelta: mapInitialRegion.latitudeDelta,
            longitudeDelta: mapInitialRegion.longitudeDelta,
          }}
          onPress={handleMapPress}
          onTouchStart={handleMapTouchStart}
          onTouchEnd={handleMapTouchEnd}
          onMapReady={handleMapReady}
          moveOnMarkerPress={false}
          scrollEnabled
          zoomEnabled
          rotateEnabled={false}
          pitchEnabled={false}
          showsUserLocation={false}
          showsMyLocationButton={false}
          {...(Platform.OS === 'android' && {
            onMoveShouldSetResponder: () => true,
            onResponderMove: () => {},
          })}
        >
          <MapMarker
            coordinate={shopCoordinate}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={200}
            tracksViewChanges={false}
            onPress={handleShopMarkerPress}
          >
            <TouchableOpacity activeOpacity={1} onPress={handleShopMarkerPress}>
              <View style={styles.shopMarkerContainer}>
                <View style={styles.shopMarker}>
                  <ShopIcon size={32} color="#16a34a" />
                </View>
                {showShopCallout && !showShopNameLabel && (
                  <View style={styles.shopCallout}>
                    <Text style={styles.shopCalloutText}>{t('merchant.delivery.manageAreas.yourShop')}</Text>
                    <View style={styles.shopCalloutArrow} />
                  </View>
                )}
                {showShopNameLabel && (
                  <View style={styles.shopNameLabel}>
                    <Text style={styles.shopNameLabelText}>{shop.name}</Text>
                    <View style={styles.shopNameLabelArrow} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </MapMarker>
          {areas.map(renderPolygon)}
          {editingVertices.length >= 2 ? (
            <MapPolyline
              coordinates={editingVertices}
              strokeColor="#2563eb"
              strokeWidth={2}
              lineDashPattern={[6, 4]}
            />
          ) : null}
          {editingVertices.length >= 3 ? (
            <MapPolygon
              coordinates={editingVertices}
              strokeColor="#2563eb"
              fillColor="#2563eb25"
              strokeWidth={2}
            />
          ) : null}
          {editingVertices.map((vertex, index) => (
            <MapMarker
              key={`editing-vertex-${index}`}
              coordinate={vertex}
              pinColor="#2563eb"
              title={`${t('merchant.delivery.manageAreas.dropPoints')} ${index + 1}`}
              zIndex={150 + index}
            />
          ))}
        </MapView>
      </View>

      <View pointerEvents="box-none" style={[styles.topOverlay, { top: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('merchant.delivery.manageAreas.back')}
        >
          <Text style={styles.backButtonText}>{t('merchant.delivery.manageAreas.back')}</Text>
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{t('merchant.delivery.manageAreas.title')}</Text>
          <Text style={styles.infoBody}>
            {t('merchant.delivery.manageAreas.description')}
          </Text>
        </View>
      </View>

      <View pointerEvents="box-none" style={[styles.bottomOverlay, { bottom: insets.bottom + 16 }]}>
        {hasValidLocation && (
          <TouchableOpacity
            onPress={handleGeolocate}
            style={styles.geolocateButton}
            accessibilityRole="button"
            accessibilityLabel={t('merchant.delivery.manageAreas.centerOnShop')}
          >
            <GeolocateIcon size={20} color="#ffffff" />
          </TouchableOpacity>
        )}
        <View style={styles.bottomCard}>
          <Text style={styles.bottomTitle}>{t('merchant.delivery.manageAreas.currentZones')}</Text>
          {areas.length === 0 ? (
            <Text style={styles.bottomEmpty}>{t('merchant.delivery.manageAreas.noZonesYet')}</Text>
          ) : (
            <View style={styles.zoneChips}>
              {areas.map((area, index) => {
                const zoneColor = getZoneColor(index);
                return (
                  <View
                    key={area.id ? area.id : `zone-${index}`}
                    style={[styles.zoneChip, { backgroundColor: `${zoneColor}20`, borderColor: zoneColor }]}
                  >
                    <Text style={[styles.zoneChipText, { color: zoneColor }]}>{area.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
          {isEditing ? (
            <View style={styles.editingHint}>
              <Text style={styles.editingHintTitle}>{t('merchant.delivery.manageAreas.dropPoints')}</Text>
              <Text style={styles.editingHintBody}>
                {editingVertices.length === 1
                  ? t('merchant.delivery.manageAreas.pointsPlaced', { count: editingVertices.length })
                  : t('merchant.delivery.manageAreas.pointsPlacedPlural', { count: editingVertices.length })}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actionsRow}>
          {isEditing ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={cancelPolygon}
                accessibilityRole="button"
              >
                <Text style={styles.actionButtonCancelText}>{t('merchant.delivery.manageAreas.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.undoButton,
                  editingVertices.length === 0 && styles.disabledButton,
                ]}
                onPress={undoVertex}
                disabled={editingVertices.length === 0}
                accessibilityRole="button"
              >
                <Text style={styles.undoText}>{t('merchant.delivery.manageAreas.undoPoint')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.doneButton,
                  editingVertices.length < 3 && styles.disabledDoneButton,
                ]}
                onPress={completePolygon}
                disabled={editingVertices.length < 3}
                accessibilityRole="button"
              >
                <Text style={styles.doneText}>{t('merchant.delivery.manageAreas.done')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.addPolygonButton]}
                onPress={startPolygon}
                accessibilityRole="button"
              >
                <Text style={styles.addPolygonText}>{t('merchant.delivery.manageAreas.addDeliveryArea')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton, !hasChanges && styles.disabledSaveButton]}
                onPress={handleSave}
                disabled={!hasChanges || saveMutation.isLoading}
                accessibilityRole="button"
              >
                {saveMutation.isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveText}>{t('merchant.delivery.manageAreas.save')}</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {(isLoading || saveMutation.isLoading) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  map: {
    flex: 1,
  },
  mapWrapper: {
    flex: 1,
  },
  topOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  infoBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
  },
  tipCard: {
    marginTop: 12,
    backgroundColor: '#e0f2fe',
    borderRadius: 20,
    padding: 12,
  },
  tipTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tipBody: {
    marginTop: 8,
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 18,
  },
  bottomOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  geolocateButton: {
    position: 'absolute',
    right: 0,
    bottom: 160,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  bottomCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: 16,
  },
  bottomTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  bottomEmpty: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
  },
  zoneChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  zoneChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1.5,
  },
  zoneChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  editingHint: {
    marginTop: 12,
    backgroundColor: 'rgba(191, 219, 254, 0.9)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  editingHintTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e3a8a',
  },
  editingHintBody: {
    marginTop: 4,
    fontSize: 12,
    color: '#1d4ed8',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#e5e7eb',
  },
  actionButtonCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  undoButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  undoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  disabledButton: {
    opacity: 0.5,
  },
  doneButton: {
    backgroundColor: '#2563eb',
  },
  disabledDoneButton: {
    backgroundColor: '#93c5fd',
  },
  doneText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  addPolygonButton: {
    backgroundColor: '#2563eb',
  },
  addPolygonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  saveButton: {
    backgroundColor: '#16a34a',
  },
  disabledSaveButton: {
    backgroundColor: '#86efac',
  },
  saveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shopMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopMarker: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
    borderWidth: 2,
    borderColor: '#16a34a',
  },
  shopCallout: {
    position: 'absolute',
    bottom: 48,
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    alignItems: 'center',
  },
  shopCalloutText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  shopCalloutArrow: {
    position: 'absolute',
    bottom: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#16a34a',
  },
  shopNameLabel: {
    position: 'absolute',
    bottom: 48,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    alignItems: 'center',
    maxWidth: 200,
  },
  shopNameLabelText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  shopNameLabelArrow: {
    position: 'absolute',
    bottom: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#2563eb',
  },
});


