export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: '12';
  };
  public: {
    Tables: {
      admin_users: {
        Row: {
          id: string;
          role: string;
          name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          role?: string;
          name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          role?: string;
          name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      site_config: {
        Row: {
          id: string;
          key: string;
          value: string;
          value_type: string;
          category: string;
          description: string | null;
          is_seed: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          key: string;
          value: string;
          value_type?: string;
          category: string;
          description?: string | null;
          is_seed?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          key?: string;
          value?: string;
          value_type?: string;
          category?: string;
          description?: string | null;
          is_seed?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      landing_sections: {
        Row: {
          id: string;
          section_key: string;
          title: string | null;
          subtitle: string | null;
          description: string | null;
          eyebrow: string | null;
          is_visible: boolean;
          order_index: number;
          extra_data: Json;
          is_seed: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          section_key: string;
          title?: string | null;
          subtitle?: string | null;
          description?: string | null;
          eyebrow?: string | null;
          is_visible?: boolean;
          order_index: number;
          extra_data?: Json;
          is_seed?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          section_key?: string;
          title?: string | null;
          subtitle?: string | null;
          description?: string | null;
          eyebrow?: string | null;
          is_visible?: boolean;
          order_index?: number;
          extra_data?: Json;
          is_seed?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      hero_slides: {
        Row: {
          id: string;
          page: string;
          slide_index: number;
          eyebrow: string | null;
          title_line1: string;
          title_line2: string | null;
          subtitle: string | null;
          description: string | null;
          cta_primary_text: string | null;
          cta_primary_link: string | null;
          cta_secondary_text: string | null;
          cta_secondary_link: string | null;
          video_url: string | null;
          video_webm_url: string | null;
          poster_url: string | null;
          is_visible: boolean;
          order_index: number;
          is_seed: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          page: string;
          slide_index: number;
          eyebrow?: string | null;
          title_line1: string;
          title_line2?: string | null;
          subtitle?: string | null;
          description?: string | null;
          cta_primary_text?: string | null;
          cta_primary_link?: string | null;
          cta_secondary_text?: string | null;
          cta_secondary_link?: string | null;
          video_url?: string | null;
          video_webm_url?: string | null;
          poster_url?: string | null;
          is_visible?: boolean;
          order_index: number;
          is_seed?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          page?: string;
          slide_index?: number;
          eyebrow?: string | null;
          title_line1?: string;
          title_line2?: string | null;
          subtitle?: string | null;
          description?: string | null;
          cta_primary_text?: string | null;
          cta_primary_link?: string | null;
          cta_secondary_text?: string | null;
          cta_secondary_link?: string | null;
          video_url?: string | null;
          video_webm_url?: string | null;
          poster_url?: string | null;
          is_visible?: boolean;
          order_index?: number;
          is_seed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_items: {
        Row: {
          id: string;
          icon_key: string;
          icon_svg: string | null;
          title: string;
          description: string;
          is_visible: boolean;
          order_index: number;
          is_seed: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          icon_key: string;
          icon_svg?: string | null;
          title: string;
          description: string;
          is_visible?: boolean;
          order_index: number;
          is_seed?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          icon_key?: string;
          icon_svg?: string | null;
          title?: string;
          description?: string;
          is_visible?: boolean;
          order_index?: number;
          is_seed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      signage_types: {
        Row: {
          id: string;
          number_label: string;
          title: string;
          description: string;
          link: string;
          image_url: string;
          icon_key: string | null;
          is_visible: boolean;
          order_index: number;
          is_seed: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          number_label: string;
          title: string;
          description: string;
          link: string;
          image_url: string;
          icon_key?: string | null;
          is_visible?: boolean;
          order_index: number;
          is_seed?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          number_label?: string;
          title?: string;
          description?: string;
          link?: string;
          image_url?: string;
          icon_key?: string | null;
          is_visible?: boolean;
          order_index?: number;
          is_seed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      client_projects: {
        Row: {
          id: string;
          category: string;
          name: string;
          project_type: string;
          image_url: string;
          is_visible: boolean;
          order_index: number;
          is_seed: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category: string;
          name: string;
          project_type: string;
          image_url: string;
          is_visible?: boolean;
          order_index: number;
          is_seed?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category?: string;
          name?: string;
          project_type?: string;
          image_url?: string;
          is_visible?: boolean;
          order_index?: number;
          is_seed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_filter_tabs: {
        Row: {
          id: string;
          tab_key: string;
          label: string;
          order_index: number;
          is_visible: boolean;
          is_seed: boolean;
        };
        Insert: {
          id?: string;
          tab_key: string;
          label: string;
          order_index: number;
          is_visible?: boolean;
          is_seed?: boolean;
        };
        Update: {
          id?: string;
          tab_key?: string;
          label?: string;
          order_index?: number;
          is_visible?: boolean;
          is_seed?: boolean;
        };
        Relationships: [];
      };
      product_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          defaults: Json;
          order_index: number;
          is_visible: boolean;
          is_seed: boolean;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          description?: string | null;
          defaults?: Json;
          order_index: number;
          is_visible?: boolean;
          is_seed?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          defaults?: Json;
          order_index?: number;
          is_visible?: boolean;
          is_seed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          slug: string;
          name: string;
          category_id: string | null;
          price: string;
          price_range: string | null;
          thumbnail: string;
          images: Json;
          description: string | null;
          full_description: string | null;
          features: Json;
          specs: Json;
          production_time: string | null;
          included_services: Json;
          tags: Json;
          material_images: Json;
          lighting_images: Json;
          options: Json;
          production_steps: Json;
          installation_gallery: Json;
          popularity: number;
          is_new: boolean;
          is_featured: boolean;
          related_product_ids: Json;
          is_visible: boolean;
          is_seed: boolean;
          is_fixed_price: boolean;
          fixed_price: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          slug: string;
          name: string;
          category_id?: string | null;
          price?: string;
          price_range?: string | null;
          thumbnail: string;
          images?: Json;
          description?: string | null;
          full_description?: string | null;
          features?: Json;
          specs?: Json;
          production_time?: string | null;
          included_services?: Json;
          tags?: Json;
          material_images?: Json;
          lighting_images?: Json;
          options?: Json;
          production_steps?: Json;
          installation_gallery?: Json;
          popularity?: number;
          is_new?: boolean;
          is_featured?: boolean;
          related_product_ids?: Json;
          is_visible?: boolean;
          is_seed?: boolean;
          is_fixed_price?: boolean;
          fixed_price?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          category_id?: string | null;
          price?: string;
          price_range?: string | null;
          thumbnail?: string;
          images?: Json;
          description?: string | null;
          full_description?: string | null;
          features?: Json;
          specs?: Json;
          production_time?: string | null;
          included_services?: Json;
          tags?: Json;
          material_images?: Json;
          lighting_images?: Json;
          options?: Json;
          production_steps?: Json;
          installation_gallery?: Json;
          popularity?: number;
          is_new?: boolean;
          is_featured?: boolean;
          related_product_ids?: Json;
          is_visible?: boolean;
          is_seed?: boolean;
          is_fixed_price?: boolean;
          fixed_price?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'product_categories';
            referencedColumns: ['id'];
          }
        ];
      };
      portfolio_items: {
        Row: {
          id: string;
          title: string;
          category: string;
          description: string | null;
          client_name: string | null;
          location: string | null;
          completed_date: string | null;
          image_before: string | null;
          image_after: string | null;
          image_process: string | null;
          product_used: string | null;
          testimonial: string | null;
          is_visible: boolean;
          order_index: number;
          is_seed: boolean;
          updated_at: string;
        };
        Insert: {
          id: string;
          title: string;
          category: string;
          description?: string | null;
          client_name?: string | null;
          location?: string | null;
          completed_date?: string | null;
          image_before?: string | null;
          image_after?: string | null;
          image_process?: string | null;
          product_used?: string | null;
          testimonial?: string | null;
          is_visible?: boolean;
          order_index: number;
          is_seed?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          category?: string;
          description?: string | null;
          client_name?: string | null;
          location?: string | null;
          completed_date?: string | null;
          image_before?: string | null;
          image_after?: string | null;
          image_process?: string | null;
          product_used?: string | null;
          testimonial?: string | null;
          is_visible?: boolean;
          order_index?: number;
          is_seed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      faq_categories: {
        Row: {
          id: string;
          name: string;
          icon_key: string | null;
          order_index: number;
          is_seed: boolean;
        };
        Insert: {
          id: string;
          name: string;
          icon_key?: string | null;
          order_index: number;
          is_seed?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          icon_key?: string | null;
          order_index?: number;
          is_seed?: boolean;
        };
        Relationships: [];
      };
      faq_items: {
        Row: {
          id: string;
          category_id: string | null;
          question: string;
          answer: string;
          is_visible: boolean;
          order_index: number;
          is_seed: boolean;
          updated_at: string;
        };
        Insert: {
          id: string;
          category_id?: string | null;
          question: string;
          answer: string;
          is_visible?: boolean;
          order_index: number;
          is_seed?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string | null;
          question?: string;
          answer?: string;
          is_visible?: boolean;
          order_index?: number;
          is_seed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      landing_faqs: {
        Row: {
          id: string;
          question: string;
          answer: string;
          is_visible: boolean;
          order_index: number;
          is_seed: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question: string;
          answer: string;
          is_visible?: boolean;
          order_index: number;
          is_seed?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          question?: string;
          answer?: string;
          is_visible?: boolean;
          order_index?: number;
          is_seed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      trust_indicators: {
        Row: {
          id: string;
          number_text: string;
          label: string;
          description: string;
          order_index: number;
          is_visible: boolean;
          is_seed: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          number_text: string;
          label: string;
          description: string;
          order_index: number;
          is_visible?: boolean;
          is_seed?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          number_text?: string;
          label?: string;
          description?: string;
          order_index?: number;
          is_visible?: boolean;
          is_seed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      client_logos: {
        Row: {
          id: string;
          name: string;
          logo_url: string;
          website_url: string | null;
          order_index: number;
          is_visible: boolean;
          is_seed: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          logo_url: string;
          website_url?: string | null;
          order_index: number;
          is_visible?: boolean;
          is_seed?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          logo_url?: string;
          website_url?: string | null;
          order_index?: number;
          is_visible?: boolean;
          is_seed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      about_sections: {
        Row: {
          id: string;
          section_key: string;
          content: Json;
          is_visible: boolean;
          order_index: number;
          is_seed: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          section_key: string;
          content: Json;
          is_visible?: boolean;
          order_index: number;
          is_seed?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          section_key?: string;
          content?: Json;
          is_visible?: boolean;
          order_index?: number;
          is_seed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      blog_posts: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          content: string;
          category: string | null;
          tags: Json;
          image_url: string | null;
          image_alt: string | null;
          author: string;
          is_published: boolean;
          published_at: string | null;
          is_seed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description?: string | null;
          content: string;
          category?: string | null;
          tags?: Json;
          image_url?: string | null;
          image_alt?: string | null;
          author?: string;
          is_published?: boolean;
          published_at?: string | null;
          is_seed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          description?: string | null;
          content?: string;
          category?: string | null;
          tags?: Json;
          image_url?: string | null;
          image_alt?: string | null;
          author?: string;
          is_published?: boolean;
          published_at?: string | null;
          is_seed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      quote_requests: {
        Row: {
          id: string;
          customer_name: string;
          email: string | null;
          phone: string | null;
          business_name: string | null;
          request_type: string | null;
          products: Json;
          message: string | null;
          attachments: Json;
          status: string;
          admin_notes: string | null;
          quoted_items: Json;
          quoted_price: number;
          quoted_at: string | null;
          user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_name: string;
          email?: string | null;
          phone?: string | null;
          business_name?: string | null;
          request_type?: string | null;
          products?: Json;
          message?: string | null;
          attachments?: Json;
          status?: string;
          admin_notes?: string | null;
          quoted_items?: Json;
          quoted_price?: number;
          quoted_at?: string | null;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_name?: string;
          email?: string | null;
          phone?: string | null;
          business_name?: string | null;
          request_type?: string | null;
          products?: Json;
          message?: string | null;
          attachments?: Json;
          status?: string;
          admin_notes?: string | null;
          quoted_items?: Json;
          quoted_price?: number;
          quoted_at?: string | null;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      contact_inquiries: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          inquiry_type: string | null;
          message: string;
          status: string;
          admin_notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          inquiry_type?: string | null;
          message: string;
          status?: string;
          admin_notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          inquiry_type?: string | null;
          message?: string;
          status?: string;
          admin_notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      simulator_config: {
        Row: {
          id: string;
          key: string;
          value: Json;
          description: string | null;
          is_seed: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value: Json;
          description?: string | null;
          is_seed?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: Json;
          description?: string | null;
          is_seed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      page_contents: {
        Row: {
          id: string;
          page_key: string;
          content_key: string;
          value: string;
          is_seed: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          page_key: string;
          content_key: string;
          value: string;
          is_seed?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          page_key?: string;
          content_key?: string;
          value?: string;
          is_seed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      navigation_items: {
        Row: {
          id: string;
          nav_type: string;
          label: string;
          href: string;
          order_index: number;
          is_visible: boolean;
          icon_key: string | null;
          is_seed: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nav_type: string;
          label: string;
          href: string;
          order_index: number;
          is_visible?: boolean;
          icon_key?: string | null;
          is_seed?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nav_type?: string;
          label?: string;
          href?: string;
          order_index?: number;
          is_visible?: boolean;
          icon_key?: string | null;
          is_seed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      inquiry_types: {
        Row: {
          id: string;
          label: string;
          value: string;
          order_index: number;
          is_visible: boolean;
          is_seed: boolean;
        };
        Insert: {
          id?: string;
          label: string;
          value: string;
          order_index: number;
          is_visible?: boolean;
          is_seed?: boolean;
        };
        Update: {
          id?: string;
          label?: string;
          value?: string;
          order_index?: number;
          is_visible?: boolean;
          is_seed?: boolean;
        };
        Relationships: [];
      };
      seed_data_backup: {
        Row: {
          id: string;
          table_name: string;
          record_id: string;
          seed_data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          table_name: string;
          record_id: string;
          seed_data: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          table_name?: string;
          record_id?: string;
          seed_data?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          quote_id: string | null;
          customer_name: string;
          customer_email: string | null;
          customer_phone: string;
          business_name: string | null;
          shipping_address: Json;
          items: Json;
          total_amount: number;
          currency: string;
          status: string;
          admin_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number?: string;
          quote_id?: string | null;
          customer_name: string;
          customer_email?: string | null;
          customer_phone: string;
          business_name?: string | null;
          shipping_address?: Json;
          items?: Json;
          total_amount: number;
          currency?: string;
          status?: string;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          quote_id?: string | null;
          customer_name?: string;
          customer_email?: string | null;
          customer_phone?: string;
          business_name?: string | null;
          shipping_address?: Json;
          items?: Json;
          total_amount?: number;
          currency?: string;
          status?: string;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'quote_requests';
            referencedColumns: ['id'];
          }
        ];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          idempotency_key: string;
          amount: number;
          currency: string;
          status: string;
          pg_provider: string | null;
          pg_payment_id: string | null;
          pg_response: Json;
          method: string | null;
          failed_reason: string | null;
          paid_at: string | null;
          canceled_at: string | null;
          refunded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          idempotency_key: string;
          amount: number;
          currency?: string;
          status?: string;
          pg_provider?: string | null;
          pg_payment_id?: string | null;
          pg_response?: Json;
          method?: string | null;
          failed_reason?: string | null;
          paid_at?: string | null;
          canceled_at?: string | null;
          refunded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          idempotency_key?: string;
          amount?: number;
          currency?: string;
          status?: string;
          pg_provider?: string | null;
          pg_payment_id?: string | null;
          pg_response?: Json;
          method?: string | null;
          failed_reason?: string | null;
          paid_at?: string | null;
          canceled_at?: string | null;
          refunded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          }
        ];
      };
      payment_status_logs: {
        Row: {
          id: string;
          payment_id: string;
          from_status: string;
          to_status: string;
          reason: string | null;
          actor: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          from_status: string;
          to_status: string;
          reason?: string | null;
          actor?: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          payment_id?: string;
          from_status?: string;
          to_status?: string;
          reason?: string | null;
          actor?: string;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_status_logs_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          }
        ];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          phone: string | null;
          provider: string;
          status: string;
          admin_notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          provider?: string;
          status?: string;
          admin_notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          provider?: string;
          status?: string;
          admin_notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
