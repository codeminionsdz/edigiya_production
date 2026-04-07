-- Add admin write policies for homepage_banners
CREATE POLICY "homepage_banners_write_admin" ON homepage_banners
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'email' LIKE '%@admin%');

CREATE POLICY "homepage_banners_update_admin" ON homepage_banners
  FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'email' LIKE '%@admin%')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'email' LIKE '%@admin%');

CREATE POLICY "homepage_banners_delete_admin" ON homepage_banners
  FOR DELETE
  USING (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'email' LIKE '%@admin%');
