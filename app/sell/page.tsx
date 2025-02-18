'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Database } from '../../types/supabase';
import ImageUpload from '../../components/ImageUpload';
import Link from 'next/link';
import { CheckIcon } from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCarSide } from '@fortawesome/free-solid-svg-icons';
import { faSearch, faCamera, faChartLine, faHeadset } from '@fortawesome/free-solid-svg-icons';
import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

type Car = Database['public']['Tables']['cars']['Row'];
type Brand = Database['public']['Tables']['brands']['Row'];
type Model = Database['public']['Tables']['models']['Row'];

interface ExtendedCar extends Car {
  brand: Brand;
  model: Model;
  images: { url: string }[];
}

interface FormData {
  description: string;
  price: string;
  brand: string;  // Brand ID as string
  model: string;  // Model ID as string
  year: string;
  mileage: string;
  fuel_type: string;
  gearbox_type: string;
  body_type: string;
  condition: string;
  color: string;
  cylinders: string;
  location: string;
  images: File[];
}

const initialFormData: FormData = {
  description: '',
  price: '',
  brand: '',
  model: '',
  year: '',
  mileage: '',
  fuel_type: '',
  gearbox_type: '',
  body_type: '',
  condition: '',
  color: '',
  cylinders: '',
  location: '',
  images: [],
};

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 50 }, (_, i) => (currentYear - i).toString());

const fuelTypes = ['Petrol', 'Diesel', 'Hybrid', 'Electric'];
const gearboxTypes = ['Manual', 'Automatic'];
const bodyTypes = ['Sedan', 'SUV', 'Hatchback', 'Coupe', 'Truck', 'Van', 'Wagon', 'Convertible', 'Other'];
const conditions = ['New', 'Excellent', 'Good', 'Not Working'];
const colors =['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Brown', 'Purple', 'Gold', 'Beige', 'Maroon', 'Navy', 'Bronze', 'Other'];
const cylinderOptions = ['Electric', '3', '4', '5', '6', '8', '10', '12', '16'];

// Location options with translation keys
const locations = [
  { key: 'doha', value: 'Doha' },
  { key: 'alwakrah', value: 'Al Wakrah' },
  { key: 'alkhor', value: 'Al Khor' },
  { key: 'lusail', value: 'Lusail' },
  { key: 'alrayyan', value: 'Al Rayyan' },
  { key: 'ummsalal', value: 'Umm Salal' },
  { key: 'aldaayen', value: 'Al Daayen' },
  { key: 'alshamal', value: 'Al Shamal' },
  { key: 'alshahaniya', value: 'Al Shahaniya' }
];

export default function SellPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const { t } = useLanguage();

  const features = useMemo(() => ({
    free: [
      t('sell.features.basic.visibility'),
      t('sell.features.basic.photos'),
      t('sell.features.basic.search'),
      t('sell.features.basic.details'),
      t('sell.features.basic.duration'),
      t('sell.features.basic.support')
    ],
    featured: [
      t('sell.features.featured.visibility'),
      t('sell.features.featured.photos'),
      t('sell.features.featured.homepage'),
      t('sell.features.featured.details'),
      t('sell.features.featured.search'),
      t('sell.features.featured.social'),
      t('sell.features.featured.duration'),
      t('sell.features.featured.support'),
      t('sell.features.featured.analytics'),
      t('sell.features.featured.badge')
    ]
  }), [t]);

  const [selectedPlan, setSelectedPlan] = useState<'free' | 'featured' | null>(null);
  const [step, setStep] = useState<'plan' | 'details'>('plan');

  const [loading, setLoading] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [carData, setCarData] = useState({
    brand_id: '',
    model_id: '',
    year: new Date().getFullYear(),
    mileage: '',
    price: '',
    description: '',
    fuel_type: '',
    gearbox_type: '',
    body_type: '',
    condition: '',
    color: '',
  });
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingImages, setExistingImages] = useState<Array<{ id: number; url: string; is_main: boolean }>>([]);
  const [imagesToDelete, setImagesToDelete] = useState<number[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [currentStep, setCurrentStep] = useState<'plan-selection' | 'step1' | 'step2' | 'step3' | 'step4'>('plan-selection');
  const [mainPhotoIndex, setMainPhotoIndex] = useState<number | null>(null);
  const totalSteps = 4; // Basic Info, Details, Images, Preview
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const steps = [
    { 
      id: 'plan-selection', 
      name: t('sell.steps.planSelection'), 
      description: t('sell.steps.planSelection.desc')
    },
    { 
      id: 'step1', 
      name: t('sell.steps.basicInfo'), 
      description: t('sell.steps.basicInfo.desc')
    },
    { 
      id: 'step2', 
      name: t('sell.steps.details'), 
      description: t('sell.steps.details.desc')
    },
    { 
      id: 'step3', 
      name: t('sell.steps.images'), 
      description: t('sell.steps.images.desc')
    },
    { 
      id: 'step4', 
      name: t('sell.steps.review'), 
      description: t('sell.steps.review.desc')
    }
  ];

  const fetchBrands = async () => {
    try {
      const { data, error } = await supabase.from('brands').select('*').order('name');
      if (error) throw error;
      setBrands(data || []);
    } catch (err) {
      toast.error('Failed to fetch brands');
      console.error(err);
    }
  };

  const fetchModels = async (brandId: string) => {
    try {
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .eq('brand_id', brandId)
        .order('name');
      if (error) throw error;
      setModels(data || []);
    } catch (err) {
      toast.error('Failed to fetch models');
      console.error(err);
    }
  };

  const fetchCarDetails = async (carId: string) => {
    try {
      const { data, error } = await supabase
        .from('cars')
        .select('*, brand:brands(*), model:models(*), images(url, is_main)')
        .eq('id', carId)
        .single();

      if (error) throw error;

      // Populate form data with existing car details
      setCarData({
        brand_id: data.brand_id,
        model_id: data.model_id,
        year: data.year,
        mileage: data.mileage,
        price: data.price,
        description: data.description,
        fuel_type: data.fuel_type,
        gearbox_type: data.gearbox_type,
        body_type: data.body_type,
        condition: data.condition,
        color: data.color,
      });

      // Populate existing images
      setExistingImages(data.images.map((img: { url: string; is_main: boolean }, index: number) => ({
        id: index,
        url: img.url,
        is_main: img.is_main
      })));

      setIsEditing(true);
    } catch (err) {
      toast.error('Failed to fetch car details');
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBrands();
    if (editId) {
      fetchCarDetails(editId);
    }
  }, [editId]);

  useEffect(() => {
    if (formData.brand) {
      fetchModels(formData.brand);
    }
  }, [formData.brand]);

  const handleContinue = () => {
    // Store the selected plan in localStorage or context
    localStorage.setItem('selectedListingPlan', selectedPlan);
    setStep('details');
  };

  const renderBasicInfo = () => (
    <div className="space-y-6 bg-white dark:bg-gray-800 shadow-lg dark:shadow-xl rounded-xl p-6 md:p-10">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          {t('sell.basic.title')}
        </h2>
        <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          {t('sell.basic.subtitle')}
        </p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Brand */}
          <div>
            <label 
              htmlFor="brand" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t('sell.basic.brand')} *
            </label>
            <select
              id="brand"
              name="brand"
              value={formData.brand}
              onChange={(e) => handleInputChange(e)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 
                         text-gray-900 dark:text-white rounded-lg shadow-sm focus:ring-2 focus:ring-qatar-maroon/50 
                         focus:border-qatar-maroon transition duration-200 ease-in-out"
            >
              <option value="">{t('sell.basic.brand.select')}</option>
              {brands.map(brand => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          {/* Model */}
          <div>
            <label 
              htmlFor="model" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t('sell.basic.model')} *
            </label>
            <select
              id="model"
              name="model"
              value={formData.model}
              onChange={(e) => handleInputChange(e)}
              required
              disabled={!formData.brand}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 
                         text-gray-900 dark:text-white rounded-lg shadow-sm focus:ring-2 focus:ring-qatar-maroon/50 
                         focus:border-qatar-maroon transition duration-200 ease-in-out 
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{t('sell.basic.model.select')}</option>
              {models.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label 
              htmlFor="year" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t('sell.basic.year')} *
            </label>
            <select
              id="year"
              name="year"
              value={formData.year}
              onChange={(e) => handleInputChange(e)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 
                         text-gray-900 dark:text-white rounded-lg shadow-sm focus:ring-2 focus:ring-qatar-maroon/50 
                         focus:border-qatar-maroon transition duration-200 ease-in-out"
            >
              <option value="">{t('sell.basic.year.select')}</option>
              {years.map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Price */}
          <div>
            <label 
              htmlFor="price" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t('sell.basic.price')} *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 dark:text-gray-400">
                {t('currency.qar')}
              </span>
              <input
                type="text"
                id="price"
                name="price"
                value={formData.price}
                onChange={(e) => handleInputChange(e)}
                required
                placeholder={t('sell.basic.price.placeholder')}
                className="w-full pl-12 px-4 py-2.5 border border-gray-300 dark:border-gray-600 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg 
                           shadow-sm focus:ring-2 focus:ring-qatar-maroon/50 focus:border-qatar-maroon 
                           transition duration-200 ease-in-out"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCarDetails = () => (
    <div className="space-y-6 bg-white dark:bg-gray-800 shadow-lg dark:shadow-xl rounded-xl p-6 md:p-10">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          {t('sell.details.title')}
        </h2>
        <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          {t('sell.details.subtitle')}
        </p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Mileage */}
          <div>
            <label 
              htmlFor="mileage" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t('sell.details.mileage')} *
            </label>
            <input
              type="number"
              id="mileage"
              name="mileage"
              value={formData.mileage}
              onChange={(e) => handleInputChange(e)}
              required
              min="0"
              placeholder={t('sell.details.mileage.placeholder')}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 
                         text-gray-900 dark:text-white rounded-lg shadow-sm focus:ring-2 focus:ring-qatar-maroon/50 
                         focus:border-qatar-maroon transition duration-200 ease-in-out"
            />
          </div>

          {/* Fuel Type */}
          <div>
            <label 
              htmlFor="fuel_type" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t('sell.details.fuelType')} *
            </label>
            <select
              id="fuel_type"
              name="fuel_type"
              value={formData.fuel_type}
              onChange={(e) => handleInputChange(e)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 
                         text-gray-900 dark:text-white rounded-lg shadow-sm focus:ring-2 focus:ring-qatar-maroon/50 
                         focus:border-qatar-maroon transition duration-200 ease-in-out"
            >
              <option value="">{t('sell.details.fuelType.select')}</option>
              {fuelTypes.map(type => (
                <option key={type} value={type}>
                  {t(`cars.fuelType.${type.toLowerCase()}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Gearbox Type */}
          <div>
            <label 
              htmlFor="gearbox_type" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t('sell.details.transmission')} *
            </label>
            <select
              id="gearbox_type"
              name="gearbox_type"
              value={formData.gearbox_type}
              onChange={(e) => handleInputChange(e)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 
                         text-gray-900 dark:text-white rounded-lg shadow-sm focus:ring-2 focus:ring-qatar-maroon/50 
                         focus:border-qatar-maroon transition duration-200 ease-in-out"
            >
              <option value="">{t('sell.details.transmission.select')}</option>
              {gearboxTypes.map(type => (
                <option key={type} value={type}>
                  {t(`cars.transmission.${type.toLowerCase()}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Body Type */}
          <div>
            <label 
              htmlFor="body_type" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t('sell.details.bodyType')} *
            </label>
            <select
              id="body_type"
              name="body_type"
              value={formData.body_type}
              onChange={(e) => handleInputChange(e)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 
                         text-gray-900 dark:text-white rounded-lg shadow-sm focus:ring-2 focus:ring-qatar-maroon/50 
                         focus:border-qatar-maroon transition duration-200 ease-in-out"
            >
              <option value="">{t('sell.details.bodyType.select')}</option>
              {bodyTypes.map(type => (
                <option key={type} value={type}>
                  {t(`cars.bodyType.${type.toLowerCase()}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Condition */}
          <div>
            <label 
              htmlFor="condition" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t('sell.details.condition')} *
            </label>
            <select
              id="condition"
              name="condition"
              value={formData.condition}
              onChange={(e) => handleInputChange(e)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 
                         text-gray-900 dark:text-white rounded-lg shadow-sm focus:ring-2 focus:ring-qatar-maroon/50 
                         focus:border-qatar-maroon transition duration-200 ease-in-out"
            >
              <option value="">{t('sell.details.condition.select')}</option>
              {conditions.map(condition => (
                <option key={condition} value={condition}>
                  {t(`cars.condition.${condition === 'Not Working' ? 'notWorking' : condition.toLowerCase()}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Color */}
          <div>
            <label 
              htmlFor="color" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t('sell.details.color')} *
            </label>
            <select
              id="color"
              name="color"
              value={formData.color}
              onChange={(e) => handleInputChange(e)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 
                         text-gray-900 dark:text-white rounded-lg shadow-sm focus:ring-2 focus:ring-qatar-maroon/50 
                         focus:border-qatar-maroon transition duration-200 ease-in-out"
            >
              <option value="">{t('sell.details.color.select')}</option>
              {colors.map(color => (
                <option key={color} value={color}>
                  {t(`cars.colors.${color.toLowerCase()}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Cylinders */}
          <div>
            <label 
              htmlFor="cylinders" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t('sell.details.cylinders')} *
            </label>
            <select
              id="cylinders"
              name="cylinders"
              value={formData.cylinders}
              onChange={(e) => handleInputChange(e)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 
                         text-gray-900 dark:text-white rounded-lg shadow-sm focus:ring-2 focus:ring-qatar-maroon/50 
                         focus:border-qatar-maroon transition duration-200 ease-in-out"
            >
              <option value="">{t('sell.details.cylinders.select')}</option>
              {cylinderOptions.map(cyl => (
                <option key={cyl} value={cyl}>
                  {cyl === 'Electric' 
                    ? t('sell.details.cylinders.electric')
                    : t('sell.details.cylinders.count', { count: Number(cyl) })}
                </option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label 
              htmlFor="location" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t('sell.details.location')} *
            </label>
            <select
              id="location"
              name="location"
              value={formData.location}
              onChange={(e) => handleInputChange(e)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 
                         text-gray-900 dark:text-white rounded-lg shadow-sm focus:ring-2 focus:ring-qatar-maroon/50 
                         focus:border-qatar-maroon transition duration-200 ease-in-out"
            >
              <option value="">{t('sell.details.location.select')}</option>
              {locations.map(location => (
                <option key={location.key} value={location.value}>
                  {t(`locations.${location.key}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="col-span-2">
            <label 
              htmlFor="description" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {t('sell.details.description')} *
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              value={formData.description}
              onChange={(e) => handleInputChange(e)}
              placeholder={t('sell.details.description.placeholder')}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 
                         text-gray-900 dark:text-white rounded-lg shadow-sm focus:ring-2 focus:ring-qatar-maroon/50 
                         focus:border-qatar-maroon transition duration-200 ease-in-out"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const allImages = useMemo(() => [
    ...existingImages
      .filter((_, idx) => !imagesToDelete.includes(existingImages[idx].id))
      .map(img => ({ url: img.url, type: 'existing' as const })),
    ...newImages.map(file => ({ 
      url: URL.createObjectURL(file), 
      type: 'new' as const 
    }))
  ], [existingImages, imagesToDelete, newImages]);

  useEffect(() => {
    return () => {
      allImages
        .filter(img => img.type === 'new')
        .forEach(img => URL.revokeObjectURL(img.url));
    };
  }, [allImages]);

  const renderImageUpload = () => {
    const getNumberSuffix = (number: number) => {
      if (number === 1) return 'st';
      if (number === 2) return 'nd';
      if (number === 3) return 'rd';
      return 'th';
    };

    return (
      <div className="space-y-6 bg-[#1e2530] rounded-xl p-6 md:p-10">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white">
            {t('sell.images.title')}
          </h2>
          <p className="text-sm text-gray-400 mt-2">
            {t('sell.images.subtitle')}
          </p>
        </div>

        {/* Main Photo Guidance */}
        {allImages.length > 0 && mainPhotoIndex !== null && (
          <div className="bg-[#2a3441] border-l-4 border-qatar-maroon p-4 rounded-md mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 mr-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-qatar-maroon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-300">
                  {t('sell.images.main.info', {
                    number: mainPhotoIndex + 1,
                    suffix: getNumberSuffix(mainPhotoIndex + 1)
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Upload Area when no images */}
        {allImages.length === 0 && (
          <div 
            onClick={() => document.getElementById('file-upload')?.click()}
            className="cursor-pointer flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-600 rounded-lg bg-[#2a3441] hover:bg-[#323d4d] transition-colors group"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg 
                className="w-12 h-12 mb-4 text-gray-400 group-hover:text-qatar-maroon transition-colors" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                ></path>
              </svg>
              <p className="mb-2 text-sm text-gray-400 group-hover:text-white transition-colors">
                <span className="font-semibold group-hover:text-qatar-maroon">{t('sell.images.drag')}</span>
              </p>
              <p className="text-xs text-gray-500 group-hover:text-gray-300 transition-colors">
                {t('sell.images.formats')}
              </p>
            </div>
            <input
              id="file-upload"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="hidden"
            />
          </div>
        )}

        {/* Image Grid */}
        {allImages.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {allImages.map((image, index) => (
              <div 
                key={index} 
                className={`relative border-4 rounded-lg overflow-hidden transition-all duration-300 ease-in-out ${
                  index === mainPhotoIndex 
                    ? 'border-qatar-maroon shadow-lg scale-105' 
                    : 'border-[#2a3441] hover:border-gray-600'
                }`}
              >
                <img 
                  src={image.url} 
                  alt={`Car image ${index + 1}`} 
                  className="w-full h-40 object-cover"
                />
                
                {/* Main Photo Badge */}
                {index === mainPhotoIndex && (
                  <div className="absolute top-2 left-2 bg-qatar-maroon text-white px-2 py-1 rounded-full text-xs font-bold flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 110 4v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 110-4V9a2 2 0 00-2-2h-6V7a5 5 0 00-5-5z" />
                    </svg>
                    {t('sell.images.mainPhoto')}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between p-2 bg-[#1e2530]/90">
                  {/* Set as Main Photo Button */}
                  {index !== mainPhotoIndex && (
                    <button
                      type="button"
                      onClick={() => handleSetMainPhoto(index)}
                      className="bg-qatar-maroon text-white px-3 py-1.5 rounded-md text-xs 
                        transition-all duration-300 ease-in-out 
                        transform hover:scale-105 hover:shadow-lg 
                        active:scale-95 
                        focus:outline-none focus:ring-2 focus:ring-qatar-maroon/50"
                    >
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                          <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                        </svg>
                        {t('sell.images.setMain')}
                      </div>
                    </button>
                  )}

                  {/* Remove Image Button */}
                  <button
                    type="button"
                    onClick={() => 
                      image.type === 'existing' 
                        ? handleRemoveExistingImage(existingImages[index].id) 
                        : handleRemoveNewImage(index - (existingImages.length - imagesToDelete.length))
                    }
                    className="bg-[#2a3441] text-white px-3 py-1.5 rounded-md text-xs 
                      transition-all duration-300 ease-in-out 
                      transform hover:scale-105 hover:shadow-lg 
                      active:scale-95 
                      focus:outline-none focus:ring-2 focus:ring-gray-500/50 
                      hover:bg-[#323d4d] ml-auto flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0111 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v3a1 1 0 002 0V8a1 1 0 00-1-1z" />
                    </svg>
                    {t('sell.images.remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add More Photos Button */}
        <div className="mt-6 text-center">
          <label 
            htmlFor="file-upload" 
            className={`inline-block px-6 py-3 border border-transparent rounded-md text-base font-medium text-white transition-all duration-300 ${
              allImages.length >= 10 
                ? 'bg-gray-600 cursor-not-allowed' 
                : 'bg-[#2a3441] hover:bg-[#323d4d] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-qatar-maroon'
            }`}
          >
            <div className="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 01-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              {allImages.length >= 10 ? t('sell.images.maxReached') : t('sell.images.addMore')}
            </div>
          </label>
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            className="hidden"
            disabled={allImages.length >= 10}
          />
        </div>

        {/* Photo Count */}
        <div className="text-center text-sm text-gray-400 mt-2">
          {t('sell.images.count', { current: allImages.length, max: 10 })}
        </div>
      </div>
    );
  };

  const renderPreview = () => {
    const selectedBrand = brands.find(b => b.id.toString() === formData.brand);
    const selectedModel = models.find(m => m.id.toString() === formData.model);

    const previewItems = [
      { label: t('sell.basic.brand'), value: selectedBrand?.name },
      { label: t('sell.basic.model'), value: selectedModel?.name },
      { label: t('sell.basic.year'), value: formData.year },
      { label: t('sell.basic.price'), value: formData.price },
      { label: t('sell.details.mileage'), value: formData.mileage },
      { label: t('sell.details.fuelType'), value: formData.fuel_type ? t(`cars.fuelType.${formData.fuel_type.toLowerCase()}`) : null },
      { label: t('sell.details.transmission'), value: formData.gearbox_type ? t(`cars.transmission.${formData.gearbox_type.toLowerCase()}`) : null },
      { label: t('sell.details.bodyType'), value: formData.body_type ? t(`cars.bodyType.${formData.body_type.toLowerCase()}`) : null },
      { label: t('sell.details.condition'), value: formData.condition ? t(`cars.condition.${formData.condition === 'Not Working' ? 'notWorking' : formData.condition.toLowerCase()}`) : null },
      { label: t('sell.details.color'), value: formData.color ? t(`cars.colors.${formData.color.toLowerCase()}`) : null },
      { 
        label: t('sell.details.cylinders'), 
        value: formData.cylinders ? (formData.cylinders === 'Electric' ? t('sell.details.cylinders.electric') : t('sell.details.cylinders.count', { count: Number(formData.cylinders) })) : null 
      },
      { 
        label: t('sell.details.location'), 
        value: formData.location ? t(`locations.${locations.find(l => l.value === formData.location)?.key}`) : null 
      },
      { label: t('sell.details.description'), value: formData.description },
    ];

    return (
      <div className="space-y-8 bg-white dark:bg-gray-800 shadow-lg dark:shadow-xl rounded-xl p-6 md:p-10">
        {/* Preview Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            {t('sell.review.title')}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {t('sell.review.subtitle')}
          </p>
        </div>

        {/* Car Details */}
        <div className="space-y-6">
          <dl>
            {previewItems.map((item, index) => (
              <div key={item.label} className={`${
                index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-900' : 'bg-white dark:bg-gray-800'
              } px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6`}>
                <dt className="text-sm font-medium text-gray-900 dark:text-white">
                  {item.label}
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                  {item.value || t('sell.review.notSpecified')}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Images Preview */}
        <div className="space-y-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {t('sell.review.images.title')} ({existingImages.length - imagesToDelete.length + newImages.length})
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {/* Existing Images */}
            {existingImages
              .filter(img => !imagesToDelete.includes(img.id))
              .map((image, index) => (
                <div key={image.id} className="relative aspect-square group">
                  <img
                    src={image.url}
                    alt="Car"
                    className="object-cover rounded-lg w-full h-full"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded-lg" />
                  {index === mainPhotoIndex && (
                    <div className="absolute top-2 right-2 bg-qatar-maroon text-white px-2 py-1 rounded-md text-xs font-medium">
                      {t('sell.review.mainPhoto')}
                    </div>
                  )}
                </div>
              ))}
            
            {/* New Images */}
            {newImages.map((file, index) => {
              const actualIndex = index + (existingImages.length - imagesToDelete.length);
              return (
                <div key={index} className="relative aspect-square group">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`New ${index + 1}`}
                    className="object-cover rounded-lg w-full h-full"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity rounded-lg" />
                  {actualIndex === mainPhotoIndex && (
                    <div className="absolute top-2 right-2 bg-qatar-maroon text-white px-2 py-1 rounded-md text-xs font-medium">
                      {t('sell.review.mainPhoto')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Confirmation Checkbox */}
        <div className="mt-6">
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="confirm"
                name="confirm"
                type="checkbox"
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
                className="focus:ring-qatar-maroon h-4 w-4 text-qatar-maroon border-gray-300 rounded"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="confirm" className="font-medium text-gray-700 dark:text-gray-200">
                {t('sell.review.confirm.label')}
              </label>
              <p className="text-gray-500 dark:text-gray-400">
                {t('sell.review.confirm.description')}
              </p>
            </div>
          </div>
        </div>

        {/* Status Notice */}
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" />
              </svg>
            </div>
            <div className="ml-3">  
              <p className="text-sm text-yellow-700 dark:text-yellow-200">
                {t('sell.review.notice.message')}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const validateStep = () => {
    switch (currentStep) {
      case 'step1':
        return formData.brand && formData.model && formData.year && formData.price;
      case 'step2':
        return (
          formData.mileage &&
          formData.fuel_type &&
          formData.gearbox_type &&
          formData.body_type &&
          formData.condition &&
          formData.location
        );
      case 'step3':
        const totalImages = existingImages.length - imagesToDelete.length + newImages.length;
        return totalImages > 0 && totalImages <= 10 && mainPhotoIndex !== null;
      case 'step4':
        return isConfirmed;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep === 'plan-selection' && selectedPlan) {
      setCurrentStep('step1');
    } else if (currentStep === 'step1') {
      setCurrentStep('step2');
    } else if (currentStep === 'step2') {
      setCurrentStep('step3');
    } else if (currentStep === 'step3') {
      setCurrentStep('step4');
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => {
      if (prev === 'step1') {
        return 'plan-selection';
      } else if (prev === 'step2') {
        return 'step1';
      } else if (prev === 'step3') {
        return 'step2';
      } else if (prev === 'step4') {
        return 'step3';
      }
      return prev;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submission started');
    
    if (!isConfirmed) {
      toast.error(t('sell.messages.confirm'));
      return;
    }

    if (!user) {
      toast.error(t('sell.messages.login'));
      return;
    }
    
    setIsSubmitting(true);
    setError(null);

    try {
      console.log('Preparing car data...');
      // Prepare the car data with correct field names
      const carSubmitData = {
        brand_id: parseInt(formData.brand),
        model_id: parseInt(formData.model),
        year: parseInt(formData.year),
        price: parseInt(formData.price.replace(/[^0-9]/g, '')),
        mileage: parseInt(formData.mileage),
        fuel_type: formData.fuel_type,
        gearbox_type: formData.gearbox_type,
        body_type: formData.body_type,
        condition: formData.condition,
        color: formData.color,
        cylinders: formData.cylinders === 'Electric' ? 'Electric' : formData.cylinders,
        location: formData.location,
        description: formData.description,
        user_id: user.id,
        status: 'Pending',
      };

      console.log('Submitting car data:', carSubmitData);

      // Insert the car data
      const { data: carData, error: carError } = await supabase
        .from('cars')
        .insert([carSubmitData])
        .select()
        .single();

      if (carError) {
        console.error('Error inserting car data:', carError);
        throw carError;
      }

      console.log('Car data inserted successfully:', carData);

      // Handle image uploads
      if (newImages.length > 0) {
        console.log('Starting image uploads...');
        const imagePromises = newImages.map(async (file, index) => {
          try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${user.id}/${carData.id}/${fileName}`;

            console.log('Uploading image:', filePath);

            // Upload the image
            const { error: uploadError, data: uploadData } = await supabase.storage
              .from('car-images')
              .upload(filePath, file);

            if (uploadError) {
              console.error('Error uploading image:', uploadError);
              throw uploadError;
            }

            // Get the public URL
            const { data: urlData } = supabase.storage
              .from('car-images')
              .getPublicUrl(filePath);

            if (!urlData?.publicUrl) {
              throw new Error('Failed to get public URL for uploaded image');
            }

            console.log('Image uploaded successfully, public URL:', urlData.publicUrl);

            // Insert image record
            const { error: insertError } = await supabase
              .from('car_images')
              .insert([{
                car_id: carData.id,
                url: urlData.publicUrl,
                is_main: index === mainPhotoIndex
              }]);

            if (insertError) {
              console.error('Error inserting image record:', insertError);
              throw insertError;
            }

            return urlData.publicUrl;
          } catch (error) {
            console.error('Error processing image:', error);
            throw error;
          }
        });

        // Wait for all image uploads to complete
        await Promise.all(imagePromises);
      }

      // Handle existing images to delete
      if (imagesToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('car_images')
          .delete()
          .in('id', imagesToDelete);

        if (deleteError) {
          console.error('Error deleting images:', deleteError);
          throw deleteError;
        }
      }

      setIsSubmitted(true);
      toast.success(t('sell.messages.success'));
      
      // Redirect to the listings page after successful submission
      router.push('/cars');
    } catch (error: any) {
      console.error('Error in form submission:', error);
      setError(error.message || t('sell.messages.error'));
      toast.error(error.message || t('sell.messages.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    
    if (name === 'price') {
      const numericValue = value.replace(/[^0-9]/g, '');
      const formattedValue = new Intl.NumberFormat().format(parseInt(numericValue) || 0);
      setFormData(prev => ({ ...prev, [name]: formattedValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalImages = existingImages.length - imagesToDelete.length + newImages.length + files.length;
    
    if (totalImages > 10) {
      toast.error(t('sell.messages.maxImages'));
      return;
    }

    // Validate file types and sizes
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(t('sell.messages.invalidImage'));
        return;
      }

      // Increased max size to 10MB per image
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t('sell.messages.imageTooLarge'));
        return;
      }
    }

    setNewImages(prev => [...prev, ...files]);
  };

  const handleRemoveExistingImage = (imageId: number) => {
    setImagesToDelete(prev => [...prev, imageId]);
    toast.success(t('sell.messages.deleted'));
  };

  const handleRemoveNewImage = (index: number) => {
    if (index === mainPhotoIndex) {
      toast.error(t('sell.messages.mainImageWarning'));
      return;
    }

    setNewImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSetMainPhoto = (index: number) => {
    setMainPhotoIndex(index);
    // Update existing images is_main status
    setExistingImages(prev => prev.map((img, i) => ({
      ...img,
      is_main: i === index
    })));
  };

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          {t('sell.messages.login')}
        </h2>
        <button
          onClick={() => router.push('/login')}
          className="inline-block bg-qatar-maroon text-white px-6 py-3 rounded-md font-semibold hover:bg-qatar-maroon/90 transition-colors"
        >
          {t('sell.messages.loginButton')}
        </button>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
                  <svg
                    className="h-6 w-6 text-green-600 dark:text-green-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="mt-6 text-xl font-medium text-gray-900 dark:text-white">
                  {t('sell.messages.submitted')}
                </h3>
                <div className="mt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('sell.messages.review')}
                  </p>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {t('sell.messages.wait')}
                  </p>
                </div>
                <div className="mt-8 space-y-4">
                  <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 p-4 rounded-md">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg
                          className="h-5 w-5 text-yellow-400"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-yellow-700 dark:text-yellow-200">
                        {t('sell.messages.reviewTime')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center space-x-4">
                    <Link
                      href="/my-ads"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-qatar-maroon hover:bg-qatar-maroon-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-qatar-maroon"
                    >
                      {t('sell.messages.viewListings')}
                    </Link>
                    <Link
                      href="/"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-qatar-maroon"
                    >
                      {t('sell.messages.returnHome')}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'plan-selection') {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900">
        {/* Hero Section */}
        <div className="relative bg-gradient-to-br from-qatar-maroon to-qatar-maroon/90 py-16 overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <svg 
              className="h-full w-full"
              width="404"
              height="404"
              fill="none"
              viewBox="0 0 404 404"
              aria-hidden="true"
            >
              <defs>
                <pattern
                  id="pattern-squares"
                  x="0"
                  y="0"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <rect
                    x="0"
                    y="0"
                    width="4"
                    height="4"
                    className="text-white/20" 
                    fill="currentColor" 
                  />
                </pattern>
              </defs>
              <rect width="404" height="404" fill="url(#pattern-squares)" />
            </svg>
          </div>

          {/* Content Container */}
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              {/* Animated Title */}
              <h1 className="text-4xl font-extrabold text-white sm:text-5xl sm:tracking-tight lg:text-6xl animate-fade-in-up">
                {t('sell.plan.title')}
              </h1>

              {/* Subheading with Highlights */}
              <p className="mt-5 max-w-xl mx-auto text-xl text-white/80 leading-relaxed">
                {t('sell.plan.subtitle')}
                <span className="block text-white font-semibold mt-2">
                  {t('sell.plan.options')}
                </span>
              </p>

              {/* Quick Benefits */}
              <div className="mt-8 max-w-2xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/10 rounded-lg p-3 text-center hover:bg-white/20 transition">
                  <FontAwesomeIcon 
                    icon={faSearch} 
                    className="h-6 w-6 mx-auto text-white mb-2" 
                  />
                  <span className="text-xs text-white">{t('sell.plan.benefits.reach')}</span>
                </div>
                <div className="bg-white/10 rounded-lg p-3 text-center hover:bg-white/20 transition">
                  <FontAwesomeIcon 
                    icon={faCamera} 
                    className="h-6 w-6 mx-auto text-white mb-2" 
                  />
                  <span className="text-xs text-white">{t('sell.plan.benefits.photos')}</span>
                </div>
                <div className="bg-white/10 rounded-lg p-3 text-center hover:bg-white/20 transition">
                  <FontAwesomeIcon 
                    icon={faChartLine} 
                    className="h-6 w-6 mx-auto text-white mb-2" 
                  />
                  <span className="text-xs text-white">{t('sell.plan.benefits.insights')}</span>
                </div>
                <div className="bg-white/10 rounded-lg p-3 text-center hover:bg-white/20 transition">
                  <FontAwesomeIcon 
                    icon={faHeadset} 
                    className="h-6 w-6 mx-auto text-white mb-2" 
                  />
                  <span className="text-xs text-white">{t('sell.plan.benefits.support')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>



        {/* Pricing Section */} 
        <div className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mt-12 space-y-4 sm:mt-16 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0">
              {/* Free Plan */}
              <div className={`rounded-lg shadow-sm divide-y divide-gray-200 dark:divide-gray-700 ${
                selectedPlan === 'free' 
                  ? 'border-2 border-qatar-maroon' 
                  : 'border border-gray-200 dark:border-gray-700'
              }`}>
                <div className="p-6">
                  <h2 className="text-2xl font-semibold leading-6 text-gray-900 dark:text-white">
                    {t('sell.plan.free.title')}
                  </h2>
                  <p className="mt-4 text-sm text-gray-500 dark:text-gray-300">
                    {t('sell.plan.free.description')}
                  </p>
                  <p className="mt-8">
                    <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
                      {t('sell.plan.free.price')}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedPlan('free')}
                    className={`mt-8 block w-full py-2 px-3 text-sm font-semibold rounded-md text-center border-2 transition-all duration-300 ${
                      selectedPlan === 'free'
                        ? 'bg-qatar-maroon text-white border-qatar-maroon hover:bg-qatar-maroon/90'
                        : 'bg-qatar-maroon/10 text-qatar-maroon border-qatar-maroon/50 hover:bg-qatar-maroon/20 hover:border-qatar-maroon'
                    }`}
                  >
                    {t('sell.plan.free.select')}
                  </button>
                </div>
                <div className="pt-6 pb-8 px-6">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white tracking-wide uppercase">
                    {t('sell.plan.free.includes')}
                  </h3>
                  <ul role="list" className="mt-4 space-y-3">
                    {features.free.map((feature) => (
                      <li key={feature} className="flex space-x-3">
                        <CheckIcon className="flex-shrink-0 h-5 w-5 text-green-500" aria-hidden="true" />
                        <span className="text-sm text-gray-500 dark:text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Featured Plan */}
              <div className={`rounded-lg shadow-sm divide-y divide-gray-200 dark:divide-gray-700 ${
                selectedPlan === 'featured' 
                  ? 'border-2 border-qatar-maroon' 
                  : 'border border-gray-200 dark:border-gray-700'
              }`}>
                <div className="p-6">
                  <h2 className="text-2xl font-semibold leading-6 text-gray-900 dark:text-white">
                    {t('sell.plan.featured.title')}
                  </h2>
                  <p className="mt-4 text-sm text-gray-500 dark:text-gray-300">
                    {t('sell.plan.featured.description')}
                  </p>
                  <p className="mt-8">
                    <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
                      {t('sell.plan.featured.price')}
                    </span>
                    <span className="text-base font-medium text-gray-500 dark:text-gray-300">
                      {t('sell.plan.featured.period')}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedPlan('featured')}
                    className={`mt-8 block w-full py-2 px-3 text-sm font-semibold rounded-md text-center border-2 transition-all duration-300 ${
                      selectedPlan === 'featured'
                        ? 'bg-qatar-maroon text-white border-qatar-maroon hover:bg-qatar-maroon/90'
                        : 'bg-qatar-maroon/10 text-qatar-maroon border-qatar-maroon/50 hover:bg-qatar-maroon/20 hover:border-qatar-maroon'
                    }`}
                  >
                    {t('sell.plan.featured.select')}
                  </button>
                </div>
                <div className="pt-6 pb-8 px-6">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white tracking-wide uppercase">
                    {t('sell.plan.featured.includes')}
                  </h3>
                  <ul role="list" className="mt-4 space-y-3">
                    {features.featured.map((feature) => (
                      <li key={feature} className="flex space-x-3">
                        <CheckIcon className="flex-shrink-0 h-5 w-5 text-green-500" aria-hidden="true" />
                        <span className="text-sm text-gray-500 dark:text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <button
                onClick={handleNext}
                disabled={!selectedPlan}
                className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-qatar-maroon hover:bg-qatar-maroon/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-qatar-maroon disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {selectedPlan 
                  ? t('sell.plan.continue', { plan: selectedPlan === 'free' ? t('sell.plan.free.title') : t('sell.plan.featured.title') })
                  : t('sell.plan.selectPlan')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {isEditing ? t('sell.edit.title') : t('sell.title')}
          </h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">
            {t('sell.subtitle')}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="relative mb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative">
              {/* Progress Bar Background */}
              <div className="absolute top-4 left-0 w-full h-1 bg-gray-200 dark:bg-gray-800 rounded-full" />
              
              {/* Active Progress Bar */}
              <div 
                className="absolute top-4 left-0 h-1 bg-qatar-maroon rounded-full transition-all duration-500 ease-in-out"
                style={{ 
                  width: `${((['plan-selection', 'step1', 'step2', 'step3', 'step4'].indexOf(currentStep)) / 4) * 100}%`,
                  boxShadow: '0 0 10px rgba(158, 27, 52, 0.3)' 
                }}
              />

              {/* Steps */}
              <div className="relative flex justify-between">
                {steps.map((step) => (
                  <div key={step.id} className="flex flex-col items-center">
                    {/* Step Circle */}
                    <div 
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center mb-2
                        ${currentStep === step.id 
                          ? 'bg-qatar-maroon text-white' 
                          : 'bg-gray-200 text-gray-400 dark:bg-gray-700'
                        }
                      `}
                    >
                      {step.id === 'plan-selection' ? 'P' : step.id.replace('step', '')}
                    </div>

                    {/* Step Label */}
                    <span className={`
                      text-sm font-medium mb-1
                      ${currentStep === step.id 
                        ? 'text-qatar-maroon' 
                        : currentStep > step.id
                          ? 'text-qatar-maroon'
                          : 'text-gray-500 dark:text-gray-400'
                      }
                    `}>
                      {step.name}
                    </span>

                    {/* Step Description */}
                    <span className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-[120px]">
                      {step.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden">
            <form onSubmit={handleSubmit} className="p-8">
              {/* Form Content */}
              <div className="space-y-8">
                {currentStep === 'step1' && renderBasicInfo()}
                {currentStep === 'step2' && renderCarDetails()}
                {currentStep === 'step3' && renderImageUpload()}
                {currentStep === 'step4' && renderPreview()}
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-8 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={handleBack}
                  className={`px-6 py-2 text-sm font-medium rounded-md border-2 border-qatar-maroon/50 text-qatar-maroon hover:bg-qatar-maroon/10 hover:border-qatar-maroon transition-all duration-300 ${
                    currentStep === 'plan-selection' ? 'hidden' : ''
                  }`}
                >
                  {t('sell.nav.previous')}
                </button>

                {currentStep !== 'step4' ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!validateStep()}
                    className={`px-6 py-2 text-sm font-medium bg-qatar-maroon text-white rounded-md hover:bg-qatar-maroon/90 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {t('sell.nav.next')}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting || !isConfirmed}
                    className={`
                      px-6 py-2 rounded-md text-sm font-medium transition-all duration-300
                      ${isSubmitting || !isConfirmed
                        ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        : 'bg-qatar-maroon text-white hover:bg-qatar-maroon/90 shadow-lg hover:shadow-qatar-maroon/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-qatar-maroon'
                      }
                    `}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('sell.review.submitting')}
                      </div>
                    ) : t('sell.review.submit')}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 