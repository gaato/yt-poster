import logging
import os

import dotenv
import googleapiclient.discovery

dotenv.load_dotenv()


class YouTubeDataFetcher:
    def __init__(self, api_key: str) -> None:
        """Initializes the YouTubeDataFetcher."""
        self.youtube = googleapiclient.discovery.build(
            "youtube", "v3", developerKey=api_key
        )

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
        except Exception as e:
            logging.error(e)
            raise e
        return youtube_response["items"]

    def get_thumbnail_url(self, video_id: str) -> str:
        """
        Retrieves the thumbnail URL of a specified video.

        Args:
            video_id: The ID of the video.

        Returns:
            The thumbnail URL of the video.
        """
        video_details = self.get_video_details([video_id])[0]
        thumbnails = video_details["snippet"]["thumbnails"]
        return thumbnails.get("maxres", thumbnails["default"])["url"]
