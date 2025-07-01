import logging

import dotenv
import googleapiclient.discovery

dotenv.load_dotenv()
logger = logging.getLogger(__name__)


class YouTubeDataFetcher:
    def __init__(self, api_key: str) -> None:
        """Initializes the YouTubeDataFetcher."""
        try:
            self.youtube = googleapiclient.discovery.build(
                "youtube", "v3", developerKey=api_key
            )
            logger.info("YouTubeDataFetcher initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize YouTube API client: {e}")
            raise e

    def get_video_details(self, video_ids: list[str]) -> list[dict]:
        """
        Retrieves details of specified videos.

        Args:
            video_ids: List of video IDs.

        Returns:
            List of video details (each video detail is a dictionary).
        """
        youtube_query = self.youtube.videos().list(
            part="id,snippet,contentDetails,liveStreamingDetails",
            id=",".join(video_ids),
            maxResults=50,
        )
        try:
            youtube_response = youtube_query.execute()
            logger.info(f"Retrieved details for {len(video_ids)} video(s)")
            return youtube_response["items"]
        except Exception as e:
            logger.error(f"Failed to get video details: {e}")
            raise e

    def get_thumbnail_url(self, video_id: str) -> str:
        """
        Retrieves the thumbnail URL of a specified video.

        Args:
            video_id: The ID of the video.

        Returns:
            The thumbnail URL of the video.
        """
        try:
            video_details = self.get_video_details([video_id])[0]
            thumbnails = video_details["snippet"]["thumbnails"]
            thumbnail_url = thumbnails.get("maxres", thumbnails["default"])["url"]
            logger.info(f"Retrieved thumbnail URL for video {video_id}")
            return thumbnail_url
        except Exception as e:
            logger.error(f"Failed to get thumbnail URL for video {video_id}: {e}")
            raise e
