-- Create the 'img' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('img', 'img', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy: Allow public read access to all files in 'img' bucket
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'img' );

-- Policy: Allow authenticated users to upload files to 'img' bucket
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'img' );

-- Policy: Allow authenticated users to update files in 'img' bucket
CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'img' );

-- Policy: Allow authenticated users to delete files in 'img' bucket
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'img' );
